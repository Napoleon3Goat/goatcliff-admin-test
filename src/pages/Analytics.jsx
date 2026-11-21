import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { analytics, monthlyReport } from '../lib/adminApi'
import { friendlyError } from '../lib/errors'
import MonthlyReport from '../components/MonthlyReport'
import { pesoShort, todayManila } from '../lib/dates'
import { Loading, ErrorState, PageHeader, useLoad } from '../components/ui'

// The last 12 months, newest first, as 'YYYY-MM'
function months() {
  const [y, m] = todayManila().split('-').map(Number)
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    return d.toISOString().slice(0, 7)
  })
}
const monthName = (ym) => new Date(ym + '-01T00:00:00Z').toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// Monthly report (FR-29). Counts leave out cancelled and expired bookings.
export default function Analytics({ admin }) {
  const options = months()
  const [month, setMonth] = useState(options[0])
  const { data, error, loading, reload } = useLoad(() => analytics(admin, { month }), [month])

  // Monthly report PDF (Super Admin only): pick the parts, then the print window opens ("Save as PDF")
  const [include, setInclude] = useState({ money: true, bookings: true, guests: true })
  const [report, setReport] = useState(null) // the report being printed
  const [making, setMaking] = useState(false)
  const [reportError, setReportError] = useState('')
  const menu = useRef(null) // the Download PDF dropdown

  async function downloadReport() {
    if (!include.money && !include.bookings && !include.guests) return setReportError('Tick at least one part.')
    setMaking(true)
    setReportError('')
    try {
      setReport(await monthlyReport(month))
      menu.current.open = false // close the dropdown
    } catch (e) {
      setReportError(friendlyError(e))
    } finally {
      setMaking(false)
    }
  }

  // When the report is on the page: open the print window, then remove it when printing is done.
  // (The page title becomes the PDF's file name.)
  useEffect(() => {
    if (!report) return
    const oldTitle = document.title
    document.title = `Goat Cliff Monthly Report ${report.month}`
    const finished = () => { document.title = oldTitle; setReport(null) }
    window.addEventListener('afterprint', finished)
    const timer = setTimeout(() => window.print(), 300) // a moment for the logo to load
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', finished); document.title = oldTitle }
  }, [report])

  const tick = (part) => (e) => setInclude({ ...include, [part]: e.target.checked })

  return (
    <div>
      <PageHeader title="Reports">
        <select id="analytics-month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          {options.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
        {admin.role === 'super_admin' && (
          <details className="report-menu" ref={menu}>
            <summary className="btn-quiet">Download PDF ▾</summary>
            <div className="report-drop">
              <label className="check"><input type="checkbox" checked={include.money} onChange={tick('money')} /> Money and discounts</label>
              <label className="check"><input type="checkbox" checked={include.bookings} onChange={tick('bookings')} /> Bookings</label>
              <label className="check"><input type="checkbox" checked={include.guests} onChange={tick('guests')} /> Guests</label>
              {reportError && <p className="error" role="alert">{reportError}</p>}
              <button className="btn-primary small" onClick={downloadReport} disabled={making}>{making ? 'Preparing…' : 'Download'}</button>
            </div>
          </details>
        )}
      </PageHeader>
      {report && createPortal(<MonthlyReport data={report} show={include} preparedBy={admin.name} />, document.body)}

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && (
        <>
          <dl className="figures">
            <div><dt>Bookings</dt><dd>{data.bookings}</dd><span>{data.cancelled} cancelled</span></div>
            <div><dt>Guests</dt><dd>{data.people}</dd><span>people</span></div>
            <div><dt>Income</dt><dd>{pesoShort(data.income)}</dd><span>payments received</span></div>
            <div><dt>Failed to show</dt><dd>{data.failedRate == null ? '—' : `${data.failedRate}%`}</dd><span>{data.failed} of {data.visited} past bookings</span></div>
          </dl>

          <section className="panel">
            <h2>Bookings per day</h2>
            <DayBars rows={data.byDay} />
          </section>

          <div className="grid-2 align-start">
            <section className="panel">
              <h2>Bookings per activity</h2>
              <Bars rows={data.byActivity} />
            </section>
            <section className="panel">
              <h2>How they found Goat Cliff</h2>
              <Bars rows={data.byFoundVia} />
            </section>
            <section className="panel">
              <h2>Age group</h2>
              <Bars rows={data.byAge} keepOrder of={data.people} />
            </section>
            <section className="panel">
              <h2>Sex</h2>
              <Bars rows={data.bySex} keepOrder of={data.people} />
            </section>
            <section className="panel">
              <h2>Province</h2>
              <Bars rows={data.byProvince} of={data.people} />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

// One column per day of the month
function DayBars({ rows }) {
  const max = Math.max(1, ...rows.map(([, v]) => v))
  if (rows.every(([, v]) => !v)) return <p className="muted">No bookings this month.</p>
  return (
    <div className="day-bars" role="list">
      {rows.map(([date, v]) => (
        <div key={date} role="listitem" className="day-bar" title={`${date}: ${v} booking${v === 1 ? '' : 's'}`}>
          <span className="day-bar-value">{v || ''}</span>
          <span className="day-bar-fill" style={{ height: (v / max) * 100 + '%' }} />
          {/* every day number fits on a laptop; on a phone only 1, 5, 10, 15... are shown (CSS) */}
          <span className={`day-bar-label${Number(date.slice(8)) === 1 || Number(date.slice(8)) % 5 === 0 ? ' key' : ''}`}>{Number(date.slice(8))}</span>
        </div>
      ))}
    </div>
  )
}

// One-colour horizontal bars, labelled with their values.
function Bars({ rows, keepOrder, of }) {
  const list = keepOrder ? rows : rows.slice(0, 10)
  const max = Math.max(1, ...list.map(([, v]) => v))
  if (list.every(([, v]) => !v)) return <p className="muted">No data this month.</p>
  return (
    <ul className="bars">
      {list.map(([label, v]) => (
        <li key={label} title={`${label}: ${v}`}>
          <span className="bar-label" title={label}>{label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: (v / max) * 100 + '%' }} /></span>
          <span className="bar-value">{of ? `${v} · ${Math.round((v / of) * 100)}%` : v}</span>
        </li>
      ))}
    </ul>
  )
}

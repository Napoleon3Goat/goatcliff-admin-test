import { useState } from 'react'
import { analytics } from '../lib/adminApi'
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
// The data fields for sex, age, province and "found via" are demo-only until the backend adds them.
export default function Analytics({ admin }) {
  const options = months()
  const [month, setMonth] = useState(options[0])
  const { data, error, loading, reload } = useLoad(() => analytics(admin, { month }), [month])

  return (
    <div>
      <PageHeader title="Reports">
        <select id="analytics-month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          {options.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
      </PageHeader>
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
              <h2>How they found Goatcliff</h2>
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
          <span className="day-bar-label">{Number(date.slice(8))}</span>
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

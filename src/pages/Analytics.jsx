import { useState } from 'react'
import { analytics } from '../lib/adminApi'
import { addDays, pesoShort, todayManila } from '../lib/dates'
import { Loading, ErrorState, PageHeader, useLoad } from '../components/ui'

const RANGES = {
  30: 'Last 30 days',
  90: 'Last 90 days',
  365: 'Last 12 months',
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Simple insights from booking data (TBI feedback #1): what's busy, and who the guests are.
// Counts exclude cancelled and expired bookings.
export default function Analytics({ admin }) {
  const [days, setDays] = useState('90')
  const { data, error, loading, reload } = useLoad(
    () => analytics(admin, { from: addDays(todayManila(), -Number(days)), to: addDays(todayManila(), 30) }),
    [days],
  )

  return (
    <div>
      <PageHeader title="Reports">
        <button className="btn-quiet" disabled={!data} onClick={() => downloadCsv(data, RANGES[days])}>Download report (CSV)</button>
        <select id="analytics-range" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period">
          {Object.entries(RANGES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </PageHeader>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && (
        <>
          <dl className="figures">
            <div><dt>Bookings</dt><dd>{data.bookings}</dd><span>{data.walkIns} walk-in</span></div>
            <div><dt>Guests</dt><dd>{data.people}</dd><span>{data.groups.viewers} viewing only</span></div>
            <div><dt>Received</dt><dd>{pesoShort(data.revenue)}</dd><span>all payments</span></div>
            <div><dt>Cancelled / no-show</dt><dd>{data.cancelled} / {data.noShows}</dd><span>bookings</span></div>
          </dl>

          <div className="grid-2 align-start">
            <section className="panel">
              <h2>Bookings per activity</h2>
              <Bars rows={data.byActivity} unit="booking" />
            </section>
            <section className="panel">
              <h2>Busiest days of the week</h2>
              <Bars rows={WEEKDAYS.map((d, i) => [d, data.byWeekday[i]])} unit="guest" keepOrder />
            </section>
          </div>

          <section className="panel">
            <h2>Who our guests are</h2>
            <Bars rows={[
              ['Senior citizens', data.groups.seniors], ['PWDs', data.groups.pwd],
              ['Children 7 and below', data.groups.children], ['Atok locals', data.groups.locals],
            ]} unit="guest" keepOrder of={data.people} />
          </section>
        </>
      )}
    </div>
  )
}

// One-colour horizontal bars, labelled with their values.
function Bars({ rows, unit, keepOrder, of }) {
  const list = keepOrder ? rows : rows.slice(0, 10)
  const max = Math.max(1, ...list.map(([, v]) => v))
  if (list.every(([, v]) => !v)) return <p className="muted">No bookings in this period.</p>
  return (
    <ul className="bars">
      {list.map(([label, v]) => (
        <li key={label} title={`${label}: ${v} ${unit}${v === 1 ? '' : 's'}`}>
          <span className="bar-label" title={label}>{label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: (v / max) * 100 + '%' }} /></span>
          <span className="bar-value">{of ? `${v} · ${of ? Math.round((v / of) * 100) : 0}%` : v}</span>
        </li>
      ))}
    </ul>
  )
}

// Saves this period's numbers as a spreadsheet file (opens in Excel or Google Sheets).
function downloadCsv(data, period) {
  const rows = [
    ['Goatcliff report', period], [],
    ['Bookings', data.bookings], ['Walk-ins', data.walkIns], ['Guests', data.people], ['Viewing only', data.groups.viewers],
    ['Payments received (PHP)', data.revenue], ['Cancelled', data.cancelled], ['No-shows', data.noShows], [],
    ['Seniors', data.groups.seniors], ['PWDs', data.groups.pwd], ['Children 7 and below', data.groups.children], ['Atok locals', data.groups.locals], [],
    ['Activity', 'Bookings'], ...data.byActivity,
  ]
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `goatcliff-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

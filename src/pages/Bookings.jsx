import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listBookings } from '../lib/adminApi'
import { addDays, formatDate, pesoShort, todayManila } from '../lib/dates'
import { Loading, ErrorState, Empty, PageHeader, Badge, PAYMENT, ATTENDANCE, activityLabel, useLoad } from '../components/ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const RANGES = {
  upcoming: ['Today onward', () => ({ from: todayManila() })],
  today: ['Today', () => ({ from: todayManila(), to: todayManila() })],
  week: ['Next 7 days', () => ({ from: todayManila(), to: addDays(todayManila(), 7) })],
  past: ['Past 30 days', () => ({ from: addDays(todayManila(), -30), to: addDays(todayManila(), -1) })],
  all: ['All dates', () => ({})],
}

// Every booking, online and walk-in, with filters. Click a row to open it.
export default function Bookings({ admin }) {
  const [range, setRange] = useState('upcoming')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')

  const { data, error, loading, reload } = useLoad(
    () => listBookings(admin, { ...RANGES[range][1](), status, type, search }),
    [range, status, type, search],
  )

  return (
    <div>
      <PageHeader title="Bookings">
        <Link to="/walk-in" className="btn-primary">New booking</Link>
      </PageHeader>

      <div className="filters">
        <label>When
          <select id="filter-range" value={range} onChange={(e) => setRange(e.target.value)}>
            {Object.entries(RANGES).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label>Status
          <select id="filter-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <optgroup label="Payment">
              {Object.entries(PAYMENT).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </optgroup>
            <optgroup label="Attendance">
              {Object.entries(ATTENDANCE).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </optgroup>
          </select>
        </label>
        <label>Activity
          <select id="filter-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Camping and rock</option>
            <option value="camping">Camping only</option>
            <option value="rock">Rock only</option>
          </select>
        </label>
        <label className="grow">Search
          <input id="filter-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, reference, email or area" />
        </label>
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && data.length === 0 && <Empty text="No bookings match these filters." />}

      {data && data.length > 0 && (
        <ul className="ledger bookings-ledger panel">
          {data.map((b) => {
            const balance = Math.max(0, b.total_amount - b.amount_paid)
            const over = ['cancelled', 'failed_to_show'].includes(b.attendance_status) || ['expired', 'refunded'].includes(b.payment_status)
            const [, mm, dd] = b.visit_date.split('-')
            return (
              <li key={b.id}>
                <Link to={`/bookings/${b.id}`} className="ledger-row">
                  <span className="datemark" aria-hidden="true">
                    <b>{Number(dd)}</b>
                    <span>{MONTHS[Number(mm) - 1]}</span>
                  </span>
                  <span className="ledger-main">
                    <strong>{b.guest_name} · {b.group_size} {b.group_size === 1 ? 'person' : 'people'}</strong>
                    <span className="muted">
                      {formatDate(b.visit_date)} · {activityLabel(b.activity)}
                      {b.nights ? ` · ${b.nights} night${b.nights > 1 ? 's' : ''}` : ''}
                      {b.viewing_count ? ` · ${b.viewing_count} viewing` : ''}
                    </span>
                    <span className="ref-line">{b.reference_number}{b.source === 'walk_in' ? ' · walk-in' : ''}</span>
                  </span>
                  <span className="due">
                    {over
                      ? <Badge map={b.attendance_status !== 'upcoming' && b.attendance_status !== 'done' ? ATTENDANCE : PAYMENT} value={b.attendance_status !== 'upcoming' && b.attendance_status !== 'done' ? b.attendance_status : b.payment_status} />
                      : balance > 0
                        ? <><b>{pesoShort(b.payment_status === 'pending' ? b.amount_due : balance)}</b><span>{b.payment_status === 'pending' ? 'down payment not in yet' : 'to collect'}</span></>
                        : <><b>Paid</b><span>{b.attendance_status === 'done' ? 'visit done' : 'nothing to collect'}</span></>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {data && data.length > 0 && <p className="hint">{data.length} booking{data.length > 1 ? 's' : ''}</p>}
    </div>
  )
}

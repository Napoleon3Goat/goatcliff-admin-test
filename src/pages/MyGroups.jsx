import { useState } from 'react'
import { listMyGroups } from '../lib/adminApi'
import { formatDate, todayManila } from '../lib/dates'
import { isCamping } from '../lib/pricing'
import { Loading, ErrorState, Empty, PageHeader, Badge, ATTENDANCE, activityLabel, useLoad } from '../components/ui'
import { AttendanceButtons } from './BookingDetail'

// Field Staff: every group (guides rotate by station, so nobody is "assigned").
// Built for a phone in one hand: today first, a big Call button, big Done / Failed to show buttons.
export default function MyGroups({ admin }) {
  const [show, setShow] = useState('today')
  const { data, error, loading, reload } = useLoad(() => listMyGroups(admin), [])
  const today = todayManila()
  const all = data || []
  const rows = show === 'today'
    ? all.filter((g) => g.visit_date <= today && (g.nights ? g.visit_date >= addDaysBack(today, g.nights) : g.visit_date === today))
    : show === 'next' ? all.filter((g) => g.visit_date > today) : all.filter((g) => g.visit_date < today).reverse()

  return (
    <div>
      <PageHeader title="Today's groups" subtitle={formatDate(today)} />
      <div className="tabs" role="tablist" aria-label="Which groups">
        {[['today', 'Today'], ['next', 'Coming up'], ['past', 'Past']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={show === k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{label}</button>
        ))}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && rows.length === 0 && <Empty text={show === 'today' ? 'No groups today.' : show === 'next' ? 'Nothing booked yet.' : 'No past groups.'} />}
      <ul className="ledger panel groups">
        {rows.map((g) => (
          <li key={g.id} className="group">
            <div className="ledger-row static">
              <span className="ledger-main">
                <strong>{g.guest_name} · {g.group_size} {g.group_size === 1 ? 'person' : 'people'}</strong>
                <span className="muted">
                  {show !== 'today' ? formatDate(g.visit_date) + ' · ' : ''}{activityLabel(g.activity)}
                  {isCamping(g.activity || {}) && g.nights ? ` · ${g.nights} night${g.nights > 1 ? 's' : ''}` : ''}
                  {g.viewing_count ? ` · ${g.viewing_count} viewing only` : ''}
                  {g.senior_count ? ` · ${g.senior_count} senior` : ''}{g.pwd_count ? ` · ${g.pwd_count} PWD` : ''}{g.child_count ? ` · ${g.child_count} child` : ''}
                </span>
                {g.attendance_status !== 'upcoming' && <Badge map={ATTENDANCE} value={g.attendance_status} />}
              </span>
              <a className="btn-call" href={`tel:${g.contact_number}`} aria-label={`Call ${g.guest_name}, ${g.contact_number}`}>Call</a>
            </div>
            <AttendanceButtons admin={admin} booking={g} onDone={reload} disabled={g.attendance_status === 'cancelled'} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// A camping group that arrived N nights ago is still on site today.
function addDaysBack(date, nights) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - (nights - 1))).toISOString().slice(0, 10)
}

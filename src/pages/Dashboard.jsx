import { Link } from 'react-router-dom'
import { dashboardSummary, resetDemoData } from '../lib/adminApi'
import { pesoShort } from '../lib/dates'
import { isCamping } from '../lib/pricing'
import { isDemo } from '../lib/supabase'
import { Loading, ErrorState, activityLabel, useLoad } from '../components/ui'

// "Today": what's happening on site, the rock headcount for the next 14 days,
// tonight's camping areas, and who is arriving (with the money to collect).
export default function Dashboard({ admin }) {
  const { data, error, loading, reload } = useLoad(() => dashboardSummary(admin), [admin.id])

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading) return <Loading />

  const rockToday = data.profile[0]
  const arriving = data.arrivingToday
  return (
    <div className="today">
      <div className="page-header">
        <div>
          <h1>{longDate(data.today)}</h1>
          <p className="muted">
            {data.todays.length} group{data.todays.length === 1 ? '' : 's'} on site · {data.peopleToday} people
            {rockToday && !rockToday.closed ? ` · rock ${rockToday.booked} of ${rockToday.cap}` : rockToday?.closed ? ' · rock closed today' : ''}
          </p>
        </div>
        <div className="page-actions">
          <Link to="/bookings" className="btn-quiet">Find a booking</Link>
          <Link to="/walk-in" className="btn-primary">New booking</Link>
        </div>
      </div>

      {data.awaiting > 0 && (
        <p className="act-line">
          <DashedRing />
          <span>{data.awaiting} GCash payment{data.awaiting === 1 ? '' : 's'} to check</span>
          <Link to="/payments">Check GCash</Link>
        </p>
      )}

      <section className="panel">
        <h2>Rock headcount, next 14 days</h2>
        <Elevation days={data.profile} />
      </section>

      <div className="today-cols">
        <section className="panel">
          <h2>Camping tonight</h2>
          <CampMap areas={data.campingTonight} />
        </section>

        <section className="panel">
          <h2>Arriving today</h2>
          {arriving.length === 0 ? <p className="muted">Nobody is arriving today.</p> : (
            <ul className="ledger">
              {arriving.map((b) => <Arrival key={b.id} b={b} />)}
            </ul>
          )}
        </section>
      </div>

      {isDemo && admin.role === 'super_admin' && (
        <p className="hint demo-reset">
          <button className="link-button" onClick={() => { resetDemoData(); reload() }}>Reset demo data</button>
        </p>
      )}
    </div>
  )
}

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

// One arriving group. The right side says what the desk has to do: collect money, or nothing.
function Arrival({ b }) {
  const balance = Math.max(0, b.total_amount - b.amount_paid)
  const camping = isCamping(b.activity || {})
  const waiting = b.payment_status === 'pending'
  return (
    <li>
      <Link to={`/bookings/${b.id}`} className="ledger-row">
        <span className="ledger-main">
          <strong>{b.guest_name} · {b.group_size} {b.group_size === 1 ? 'person' : 'people'}</strong>
          <span className="muted">
            {activityLabel(b.activity)}
            {camping ? ` · check-in 1:00 PM · ${b.nights} night${b.nights > 1 ? 's' : ''}` : ''}
            {b.source === 'walk_in' ? ' · walk-in' : ''}
          </span>
        </span>
        <span className="due">
          {balance > 0 ? <><b>{pesoShort(waiting ? b.amount_due : balance)}</b><span>{waiting ? 'down payment not in yet' : 'to collect'}</span></> : <><b>Paid</b><span>nothing to collect</span></>}
        </span>
      </Link>
    </li>
  )
}

// The signature: 14 days of rock bookings drawn like a trail's elevation profile,
// with the daily limit as the summit line and closed days as a hatched gap.
function Elevation({ days }) {
  if (!days.length) return <p className="muted">No rock activity set up.</p>
  const W = 1000, TOP = 28, BASE = 118, step = W / days.length
  const maxCap = Math.max(...days.map((d) => d.cap || 0), 1)
  const y = (n) => BASE - (n / maxCap) * (BASE - TOP)
  const segments = []
  let seg = []
  days.forEach((d, i) => {
    if (d.closed) { if (seg.length) segments.push(seg); seg = [] } else seg.push([step * i + step / 2, y(d.booked), d])
  })
  if (seg.length) segments.push(seg)
  const usual = days.find((d) => !d.closed)?.cap ?? maxCap

  return (
    <figure className="elevation">
      <svg viewBox={`0 0 ${W} ${BASE + 48}`} role="img" aria-label="Rock headcount for the next 14 days">
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" className="hatch-bg" /><rect width="3" height="8" className="hatch-fg" />
          </pattern>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <g key={f}>
            <line x1="0" x2={W} y1={y(maxCap * f)} y2={y(maxCap * f)} className="contour" />
            <text x="2" y={y(maxCap * f) - 4} className="axis">{Math.round(maxCap * f)}</text>
          </g>
        ))}
        <line x1="0" x2={W} y1={y(usual)} y2={y(usual)} className="limit" />
        <text x={W - 2} y={y(usual) - 6} textAnchor="end" className="limit-label">LIMIT {usual}</text>
        {days.map((d, i) => d.closed && <rect key={'c' + i} x={step * i + 6} y={TOP} width={step - 12} height={BASE - TOP} fill="url(#hatch)" />)}
        {segments.map((sg, k) => {
          const line = sg.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')
          return (
            <g key={k}>
              <path d={`${line} L${sg[sg.length - 1][0]} ${BASE} L${sg[0][0]} ${BASE}Z`} className="ridge-fill" />
              <path d={line} className="ridge" />
              {sg.map(([px, py, d]) => (
                <g key={d.date}>
                  <circle cx={px} cy={py} r="4" className={d.booked >= d.cap ? 'peak full' : 'peak'} />
                  {(d.booked >= d.cap * 0.75 || d.cap !== usual) && (
                    <text x={px} y={py - 10} textAnchor="middle" className="peak-label">{d.booked}{d.cap !== usual ? `/${d.cap}` : ''}</text>
                  )}
                </g>
              ))}
            </g>
          )
        })}
        {days.map((d, i) => {
          const x = step * i + step / 2
          const [, , dd] = d.date.split('-')
          const wd = new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)
          return (
            <g key={d.date} className={i === 0 ? 'day today-day' : 'day'}>
              {i === 0 && <rect x={x - step / 2 + 4} y={BASE + 6} width={step - 8} height="38" rx="6" />}
              <text x={x} y={BASE + 21} textAnchor="middle" className="wd">{wd}</text>
              <text x={x} y={BASE + 38} textAnchor="middle" className="dd">{Number(dd)}</text>
            </g>
          )
        })}
      </svg>
      <figcaption className="key">
        <span className="k-ridge">People booked</span>
        <span className="k-limit">Daily limit</span>
        <span className="k-closed">Closed</span>
      </figcaption>
    </figure>
  )
}

// Tonight's camping areas on a simple site sketch (not to scale; positions are approximate).
const SPOTS = {
  UA1: [60, 96], UA2: [116, 96], UA3: [172, 96], UA4: [228, 96], UA5: [284, 96],
  LA1: [40, 200], LA2: [96, 200], LA3: [152, 200], LA4: [208, 200],
  UT: [300, 176], CA4: [370, 176], CA1: [370, 232], CA2: [426, 232], CA3: [482, 232],
}
function CampMap({ areas }) {
  const contours = Array.from({ length: 9 }, (_, k) => {
    const r = k * 26
    return `M-20 ${250 - r} C 120 ${210 - r}, 200 ${290 - r * 1.1}, 330 ${230 - r} S 520 ${170 - r * 0.8}, 600 ${200 - r}`
  })
  return (
    <figure className="campmap">
      <svg viewBox="0 0 560 290" role="img" aria-label="Camping areas tonight">
        {contours.map((d, k) => <path key={k} d={d} className={k % 4 === 3 ? 'contour index' : 'contour'} />)}
        <path d="M455 40 L520 18 L548 70 L500 98 Z" className="crag" />
        <text x="468" y="122" className="map-label">THE CRAG</text>
        <text x="60" y="86" className="map-label">UPPER AREA</text>
        <text x="40" y="190" className="map-label">LOWER AREA</text>
        <text x="300" y="166" className="map-label">TREE</text>
        <text x="370" y="284" className="map-label">CAR CAMPING</text>
        {areas.map(({ area, booking, arriving }) => {
          const pos = SPOTS[area.code]
          if (!pos) return null
          const state = !area.is_active ? 'off' : arriving ? 'arriving' : booking ? 'taken' : 'free'
          return (
            <g key={area.id} className={'plot ' + state}>
              <title>{`${area.code}: ${state === 'off' ? 'not offered' : booking ? `${booking.guest_name}, ${booking.group_size} people` : 'free tonight'}`}</title>
              <rect x={pos[0]} y={pos[1]} width="48" height="34" rx="6" />
              <text x={pos[0] + 24} y={pos[1] + 22} textAnchor="middle">{area.code}</text>
            </g>
          )
        })}
      </svg>
      <figcaption className="key">
        <span className="k-taken">Occupied</span>
        <span className="k-arriving">Checking in today</span>
        <span className="k-free">Free</span>
        <span className="k-off">Not offered</span>
      </figcaption>
    </figure>
  )
}

function DashedRing() {
  return (
    <svg viewBox="0 0 16 16" className="ring" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2.2" />
    </svg>
  )
}


import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getBooking, recordPayment, setAttendance, processCancellation, lastDay, REASONS,
} from '../lib/adminApi'
import { addDays, formatDate, peso, todayManila } from '../lib/dates'
import { isCamping, isRock, TENTS } from '../lib/pricing'
import { friendlyError } from '../lib/errors'
import { Loading, ErrorState, Empty, Badge, PAYMENT, ATTENDANCE, PAYMENT_ROW, METHODS, activityLabel, useLoad } from '../components/ui'

// One booking: guest, visit, money, attendance, and reschedule / refund / cancel.
export default function BookingDetail({ admin }) {
  const { id } = useParams()
  const { data: b, error, loading, reload } = useLoad(() => getBooking(admin, id), [id])

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading) return <Loading />
  if (!b) return <Empty text="This booking doesn't exist. It may have been removed." />

  const camping = isCamping(b.activity || {})
  const rock = isRock(b.activity || {})
  const CHANNEL = { online: 'Online', walk_in: 'Walk-in', messenger: 'Messenger', phone: 'Phone' }
  const channel = b.source === 'online' ? 'online' : (b.channel || 'walk_in')
  const ages = Object.entries(b.age_counts || {}).filter(([, n]) => n).map(([g, n]) => `${n} × ${g}`).join(', ')
  const tents = Object.entries(TENTS).filter(([k]) => b[k] > 0).map(([k, t]) => `${b[k]} × ${t.label.toLowerCase()}`).join(', ')
  const balance = Math.max(0, Math.round((b.total_amount - b.amount_paid) * 100) / 100)
  const closed = b.attendance_status === 'cancelled' || ['refunded', 'expired'].includes(b.payment_status)

  return (
    <div className="detail">
      <Link to="/bookings" className="back">← Bookings</Link>
      <div className="page-header">
        <div>
          <h1>{b.guest_name}</h1>
          <p className="muted"><span className="mono">{b.reference_number}</span> · {CHANNEL[channel]} booking{b.organizer ? ' · Organizer' : ''}</p>
        </div>
        <div className="row-badges">
          <Badge map={PAYMENT} value={b.payment_status} />
          <Badge map={ATTENDANCE} value={b.attendance_status} />
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Visit</h2>
          <dl className="facts">
            <dt>Activity</dt><dd>{activityLabel(b.activity)}</dd>
            <dt>{camping ? 'Check-in' : 'Date'}</dt><dd>{formatDate(b.visit_date)}{camping ? ', 1:00–6:00 PM' : ''}</dd>
            {camping && <><dt>Check-out</dt><dd>{formatDate(addDays(b.visit_date, b.nights))}, 12:00 noon ({b.nights} night{b.nights > 1 ? 's' : ''})</dd></>}
            <dt>Group</dt><dd>{b.group_size} {b.group_size > 1 ? 'people' : 'person'}{b.viewing_count ? `, ${b.viewing_count} viewing only` : ''}</dd>
            <dt>Discounts</dt>
            <dd>{[['senior', b.senior_count], ['PWD', b.pwd_count], ['child 7 and below', b.child_count], ['Atok local', b.local_count]]
              .filter(([, n]) => n).map(([l, n]) => `${n} ${l}`).join(', ') || 'None'}</dd>
            {b.organizer && <><dt>Organizer</dt><dd>20% off the whole group</dd></>}
            {ages && <><dt>Ages</dt><dd>{ages}</dd></>}
            {b.sex_counts && <><dt>Sex</dt><dd>{b.sex_counts.male || 0} male, {b.sex_counts.female || 0} female</dd></>}
            {tents && <><dt>Tents</dt><dd>{tents}</dd></>}
            {b.id_photos?.length > 0 && <><dt>ID photos</dt><dd>{b.id_photos.length} uploaded</dd></>}
            {b.capacity_override && <><dt>Note</dt><dd>Accepted beyond the daily limit</dd></>}
          </dl>
        </section>

        <section className="card">
          <h2>Guest</h2>
          <dl className="facts">
            <dt>Name</dt><dd>{b.guest_name}</dd>
            <dt>Mobile</dt><dd className="mono">{b.contact_number}</dd>
            <dt>Email</dt><dd className="break">{b.email}</dd>
            {b.companions_names?.length > 0 && <><dt>Companions</dt><dd>{b.companions_names.join(', ')}</dd></>}
            {b.province && <><dt>Province</dt><dd>{b.province}</dd></>}
            {b.found_via && <><dt>Found via</dt><dd>{b.found_via}</dd></>}
            {rock && <><dt>Emergency</dt><dd>{b.emergency_name ? <>{b.emergency_name} · <span className="mono">{b.emergency_contact}</span></> : '—'}</dd></>}
            <dt>Booked</dt><dd>{new Date(b.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            <dt>Entered by</dt><dd>{b.source === 'walk_in' ? (b.created_by_name || 'Staff') : 'Guest (online)'}</dd>
            <dt>Consent</dt><dd>{b.consent_given_at ? `Agreed ${new Date(b.consent_given_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}` : '—'}</dd>
          </dl>
        </section>
      </div>

      <section className="card">
        <h2>Payments</h2>
        <div className="money">
          <div><span className="hint">Total</span><strong>{peso(b.total_amount)}</strong></div>
          <div><span className="hint">Down payment (50%)</span><strong>{peso(b.amount_due)}</strong></div>
          <div><span className="hint">Paid</span><strong>{peso(b.amount_paid)}</strong></div>
          <div><span className="hint">Balance</span><strong className={balance > 0 && !closed ? 'warn-text' : ''}>{closed ? '—' : peso(balance)}</strong></div>
        </div>
        <PaymentList payments={b.payments} />
        {!closed && <RecordPayment admin={admin} booking={b} balance={balance} onDone={reload} />}
      </section>

      <section className="card">
        <h2>Attendance</h2>
        <AttendanceButtons admin={admin} booking={b} onDone={reload} disabled={b.attendance_status === 'cancelled'} />
      </section>

      {b.cancellations.length > 0 && (
        <section className="card">
          <h2>Changes</h2>
          <ul className="rows">
            {b.cancellations.map((c) => (
              <li key={c.id} className="row-static">
                <span className="row-main">
                  <strong>{c.action === 'reschedule' ? `Rescheduled from ${formatDate(c.original_visit_date)} to ${formatDate(c.new_visit_date)}` : c.action === 'refund' ? `Refund ${peso(c.refund_amount)}${c.refund_method ? ` by ${c.refund_method}` : ''}` : 'Cancelled'}</strong>
                  <span className="muted">{REASONS[c.reason_category]}{c.reason_details ? ` · ${c.reason_details}` : ''} · by {c.processed_by_name}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!closed && b.attendance_status === 'upcoming' && <ChangeBooking admin={admin} booking={b} onDone={reload} />}
    </div>
  )
}

// Payments are never deleted. Correcting a mistaken one ("void") comes in January
// with the new payment statuses; until then, ask the Super Admin.
function PaymentList({ payments }) {
  if (payments.length === 0) return <p className="muted">No payments yet.</p>
  return (
    <ul className="rows">
      {payments.map((p) => (
        <li key={p.id} className="row-static">
          <span className="row-main">
            <strong>{peso(p.amount)} · {p.purpose === 'balance' ? 'Balance' : 'Down payment'} · {METHODS[p.method] || p.method}</strong>
            <span className="muted">
              {p.transaction_reference ? <>Ref <span className="mono">{p.transaction_reference}</span> · </> : null}
              {p.paid_at ? new Date(p.paid_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not confirmed yet'} · {p.recorded_by_name}
            </span>
          </span>
          <span className="row-badges"><Badge map={PAYMENT_ROW} value={p.status} /></span>
        </li>
      ))}
    </ul>
  )
}

function RecordPayment({ admin, booking, balance, onDone }) {
  const needsDown = booking.amount_paid < booking.amount_due
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState(needsDown ? 'down_payment' : 'balance')
  const [method, setMethod] = useState('cash')
  const [txn, setTxn] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (balance <= 0) return <p className="ok-text">Fully paid.</p>
  if (!open) {
    return (
      <div className="actions-row">
        <button className="btn-primary" onClick={() => { setOpen(true); setAmount(String(needsDown ? booking.amount_due - booking.amount_paid : balance)) }}>
          Record a payment
        </button>
      </div>
    )
  }

  async function save(e) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      await recordPayment(admin, booking.id, { amount: Number(amount), purpose, method, transaction_reference: txn.trim() })
      setOpen(false); onDone()
    } catch (err) { setError(friendlyError(err)) } finally { setSaving(false) }
  }

  return (
    <form className="subform" onSubmit={save}>
      <div className="form-grid">
        <label>Amount (₱)
          <input id="pay-amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label>For
          <select id="pay-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="down_payment">Down payment</option>
            <option value="balance">Balance on arrival</option>
          </select>
        </label>
        <label>Method
          <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
          </select>
        </label>
        {method === 'gcash' && (
          <label>GCash reference
            <input id="pay-ref" value={txn} onChange={(e) => setTxn(e.target.value)} inputMode="numeric" placeholder="13 digits" />
          </label>
        )}
      </div>
      <p className="hint">Balance left: {peso(balance)}</p>
      {error && <p className="error">{error}</p>}
      <div className="actions-row">
        <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save payment'}</button>
      </div>
    </form>
  )
}

export function AttendanceButtons({ admin, booking, onDone, disabled }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [undo, setUndo] = useState(null) // after marking, offer a quick way back
  const future = booking.visit_date > todayManila()
  const LABELS = { upcoming: 'Upcoming', done: 'Done', failed_to_show: 'Failed to show' }
  async function set(status, previous) {
    setError(''); setBusy(true)
    try {
      await setAttendance(admin, booking.id, status)
      setUndo(previous ? { status, previous } : null)
      onDone()
    } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  }
  return (
    <div className="attendance">
      <div className="segmented" role="group" aria-label="Attendance">
        {Object.entries(LABELS).map(([k, label]) => (
          <button key={k} className={booking.attendance_status === k ? 'on' : ''} aria-pressed={booking.attendance_status === k}
            disabled={disabled || busy || (future && k !== 'upcoming')} onClick={() => k !== booking.attendance_status && set(k, booking.attendance_status)}>
            {label}
          </button>
        ))}
      </div>
      {undo && (
        <p className="undo" role="status">Marked {LABELS[undo.status]}.{' '}
          <button className="link-button" onClick={() => set(undo.previous, null)}>Undo</button>
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}

function ChangeBooking({ admin, booking, onDone }) {
  const [action, setAction] = useState('')
  const [reason, setReason] = useState('')
  const [refundBy, setRefundBy] = useState('GCash')
  const [details, setDetails] = useState('')
  const [newDate, setNewDate] = useState('')
  const [refund, setRefund] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Since the Oct 25 interview: reschedules and refunds are allowed until Dec 31 of the visit's year.
  const maxDate = booking.visit_date.slice(0, 4) + '-12-31'

  function start(a) {
    setAction(a); setError('')
    if (a === 'refund') setRefund(String(booking.amount_paid))
  }

  async function save(e) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      await processCancellation(admin, booking.id, {
        action, reason_category: reason, reason_details: details,
        new_visit_date: newDate, refund_amount: Number(refund), refund_method: action === 'refund' ? refundBy : null,
      })
      setAction(''); onDone()
    } catch (err) { setError(friendlyError(err)) } finally { setSaving(false) }
  }

  return (
    <section className="card">
      <h2>Reschedule, refund or cancel</h2>
      <p className="hint">At least 2 days before the visit, until Dec 31, {booking.visit_date.slice(0, 4)}.</p>
      {!action && (
        <div className="actions-row wrap">
          <button className="btn-quiet" onClick={() => start('reschedule')}>Reschedule</button>
          <button className="btn-quiet" onClick={() => start('refund')} disabled={booking.amount_paid <= 0}>Refund</button>
          <button className="btn-danger" onClick={() => start('cancel')}>Cancel booking</button>
        </div>
      )}
      {action && (
        <form className="subform" onSubmit={save}>
          <h3>{action === 'reschedule' ? 'Reschedule' : action === 'refund' ? 'Refund and cancel' : 'Cancel without refund'}</h3>
          <div className="form-grid">
            <label>Reason
              <select id="change-reason" value={reason} onChange={(e) => setReason(e.target.value)} required>
                <option value="">Choose…</option>
                {Object.entries(REASONS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            {action === 'reschedule' && (
              <label>New date
                <input id="change-date" type="date" value={newDate} min={addDays(todayManila(), 2)} max={maxDate} onChange={(e) => setNewDate(e.target.value)} required />
              </label>
            )}
            {action === 'refund' && (
              <label>Refund by
                <select id="change-refund-by" value={refundBy} onChange={(e) => setRefundBy(e.target.value)}>
                  <option>GCash</option><option>Cash</option><option>Bank transfer</option>
                </select>
              </label>
            )}
            {action === 'refund' && (
              <label>Refund amount (₱)
                <input id="change-refund" type="number" min="1" step="0.01" max={booking.amount_paid} value={refund} onChange={(e) => setRefund(e.target.value)} required />
              </label>
            )}
          </div>
          <label>Details <span className="hint">(optional)</span>
            <textarea id="change-details" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions-row">
            <button type="button" className="btn-quiet" onClick={() => setAction('')}>Back</button>
            <button className={action === 'reschedule' ? 'btn-primary' : 'btn-danger'} disabled={saving}>
              {saving ? 'Saving…' : action === 'reschedule' ? 'Save new date' : action === 'refund' ? 'Refund and cancel' : 'Cancel booking'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

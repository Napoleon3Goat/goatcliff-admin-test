import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listCancellations, markRefundProcessed, markGuestNotified, REASONS } from '../lib/adminApi'
import { formatDate, peso } from '../lib/dates'
import { friendlyError } from '../lib/errors'
import { Loading, ErrorState, Empty, PageHeader, activityLabel, useLoad } from '../components/ui'

const ACTIONS = { reschedule: ['Rescheduled', 'badge-info'], refund: ['Refunded', 'badge-wait'], cancel: ['Cancelled', 'badge-bad'] }

// History of every reschedule, refund and cancellation. New ones start from a booking's page.
export default function Cancellations({ admin }) {
  const [filter, setFilter] = useState('')
  const { data, error, loading, reload } = useLoad(() => listCancellations(admin), [])
  const rows = (data || []).filter((c) => !filter || (filter === 'todo' ? needsWork(c) : c.action === filter))
  const todo = (data || []).filter(needsWork).length

  return (
    <div>
      <PageHeader title="Requests" />
      <div className="tabs" role="tablist">
        {[['', 'All'], ['todo', `To do${todo ? ` (${todo})` : ''}`], ['reschedule', 'Reschedules'], ['refund', 'Refunds'], ['cancel', 'Cancellations']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && rows.length === 0 && <Empty text={filter === 'todo' ? 'Nothing left to do.' : 'Nothing here yet.'} />}
      {rows.length > 0 && (
        <div className="stack">
          {rows.map((c) => <Row key={c.id} admin={admin} c={c} onDone={reload} />)}
        </div>
      )}
    </div>
  )
}

function needsWork(c) {
  return (c.action === 'refund' && c.refund_status === 'pending') || !c.guest_notified_at
}

function Row({ admin, c, onDone }) {
  const [error, setError] = useState('')
  const [label, cls] = ACTIONS[c.action]
  async function run(fn) {
    setError('')
    try { await fn(); onDone() } catch (e) { setError(friendlyError(e)) }
  }
  return (
    <article className="card">
      <div className="row-between">
        <div>
          <span className={'badge ' + cls}>{label}</span>{' '}
          <Link to={`/bookings/${c.booking.id}`}><strong>{c.booking.guest_name}</strong></Link>
          <span className="muted"> · {activityLabel(c.activity)} · <span className="mono">{c.booking.reference_number}</span></span>
        </div>
        <span className="hint">{new Date(c.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })} · by {c.processed_by_name}</span>
      </div>
      <dl className="facts compact">
        <dt>Reason</dt><dd>{REASONS[c.reason_category]}{c.reason_details ? ` · ${c.reason_details}` : ''}</dd>
        <dt>Date</dt><dd>{c.action === 'reschedule' ? `${formatDate(c.original_visit_date)} → ${formatDate(c.new_visit_date)}` : formatDate(c.original_visit_date)}</dd>
        {c.action === 'refund' && <><dt>Refund</dt><dd>{peso(c.refund_amount)}{c.refund_method ? ` by ${c.refund_method}` : ''} · {c.refund_status === 'processed' ? 'Sent' : 'Not sent yet'}</dd></>}
        <dt>Guest told</dt><dd>{c.guest_notified_at ? new Date(c.guest_notified_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : 'Not yet'}</dd>
      </dl>
      <div className="actions-row wrap">
        {c.action === 'refund' && c.refund_status === 'pending' && (
          <button className="btn-quiet small" onClick={() => run(() => markRefundProcessed(admin, c.id))}>Mark refund as sent</button>
        )}
        {!c.guest_notified_at && (
          <button className="btn-quiet small" onClick={() => run(() => markGuestNotified(admin, c.id))}>Mark guest as told</button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </article>
  )
}

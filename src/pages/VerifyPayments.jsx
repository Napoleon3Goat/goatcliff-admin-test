import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listAwaitingPayment, recordPayment, releaseUnpaid } from '../lib/adminApi'
import { formatDate, peso, pesoShort } from '../lib/dates'
import { friendlyError } from '../lib/errors'
import { Loading, ErrorState, Empty, PageHeader, activityLabel, useLoad } from '../components/ui'

// Online bookings that haven't paid yet.
// This semester guests message the Facebook Page with their GCash receipt and booking reference.
// The admin checks Goatcliff's GCash, then records the payment here.
// (Guests typing the reference themselves, with a "for verification" status, comes in January.)
export default function Payments({ admin }) {
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const { data, error, loading, reload } = useLoad(() => listAwaitingPayment(admin), [])
  const q = search.trim().toLowerCase()
  const rows = (data || []).filter((b) => !q || [b.reference_number, b.guest_name].some((v) => v.toLowerCase().includes(q)))
    // Holds that already ended first: those need a decision.
    .sort((x, y) => Number(y.hold_ended) - Number(x.hold_ended))

  function done(message) { setReceipt(message); setOpenId(null); reload() }

  return (
    <div>
      <PageHeader title="GCash checks"
        />
      <div className="filters">
        <label className="grow">Find a booking
          <input id="pay-search" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="GC- reference or guest name" />
        </label>
      </div>
      {receipt && <p className="receipt" role="status">{receipt} <button className="link-button" onClick={() => setReceipt(null)}>OK</button></p>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && rows.length === 0 && <Empty text={q ? 'No unpaid booking matches that.' : 'Nothing to check. Every online booking has its down payment.'} />}
      {rows.length > 0 && (
        <ul className="ledger panel">
          {rows.map((b) => (
            <AwaitingRow key={b.id} admin={admin} b={b} open={openId === b.id}
              onToggle={() => setOpenId(openId === b.id ? null : b.id)} onDone={done} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AwaitingRow({ admin, b, open, onToggle, onDone }) {
  const [amount, setAmount] = useState(String(b.amount_due))
  const [txn, setTxn] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)
  const minutesLeft = b.hold_expires_at ? Math.round((new Date(b.hold_expires_at) - Date.now()) / 60000) : null

  async function run(fn, message) {
    setError(''); setBusy(true)
    try { await fn(); onDone(message) } catch (e) { setError(friendlyError(e)); setBusy(false) }
  }

  function record(e) {
    e.preventDefault()
    const clean = txn.replace(/\s/g, '')
    if (!/^\d{13}$/.test(clean)) return setError("Enter the 13-digit GCash reference from the guest's receipt.")
    run(() => recordPayment(admin, b.id, { amount: Number(amount), purpose: 'down_payment', method: 'gcash', transaction_reference: clean }),
      `Recorded ${peso(Number(amount))} for ${b.guest_name} (${b.reference_number}), GCash ${clean}.`)
  }

  return (
    <li className={open ? 'check-row open' : 'check-row'}>
      <div className="ledger-row static">
        <span className="ledger-main">
          <strong><span className="ref-line inline">{b.reference_number}</span> {b.guest_name}</strong>
          <span className="muted"><Link to={`/bookings/${b.id}`}>{activityLabel(b.activity)} · {formatDate(b.visit_date)}</Link> · {b.group_size} people</span>
          <span className={b.hold_ended ? 'status st-bad' : 'status st-plain'}>
            {b.hold_ended ? 'Hold ended, spot still held' : `Spot held ${Math.max(0, minutesLeft)} more minutes`}
          </span>
        </span>
        <span className="due">
          <b>{pesoShort(b.amount_due)}</b><span>down payment</span>
          {!open && <button className="btn-small" onClick={onToggle}>Record</button>}
        </span>
      </div>
      {open && (
        <form className="subform" onSubmit={record}>
          <div className="form-grid">
            <label>Amount received (₱)
              <input id={`amt-${b.id}`} type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label>GCash reference
              <input id={`txn-${b.id}`} autoFocus value={txn} onChange={(e) => setTxn(e.target.value)} inputMode="numeric" placeholder="13 digits" />
            </label>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="actions-row wrap">
            <button type="button" className="btn-quiet" onClick={onToggle}>Cancel</button>
            {b.hold_ended && !confirmRelease && (
              <button type="button" className="btn-quiet danger" disabled={busy} onClick={() => setConfirmRelease(true)}>Release spot (not paid)</button>
            )}
            <button className="btn-primary" disabled={busy}>Record GCash payment</button>
          </div>
          {confirmRelease && (
            <div className="confirm" role="alertdialog" aria-label="Release this spot?">
              <p><strong>Release {activityLabel(b.activity)} on {formatDate(b.visit_date)}?</strong> {b.guest_name}'s booking ends and the spot opens for others. Only do this if they really didn't pay.</p>
              <div className="actions-row">
                <button type="button" className="btn-quiet" onClick={() => setConfirmRelease(false)}>Keep the booking</button>
                <button type="button" className="btn-danger" disabled={busy}
                  onClick={() => run(() => releaseUnpaid(admin, b.id), `Released the spot held for ${b.guest_name} (${b.reference_number}).`)}>Yes, release it</button>
              </div>
            </div>
          )}
        </form>
      )}
    </li>
  )
}

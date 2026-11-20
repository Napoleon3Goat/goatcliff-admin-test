import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listAwaitingPayment, recordPayment, releaseUnpaid, receiptLink, confirmProof, rejectProof } from '../lib/adminApi'
import { formatDate, peso, pesoShort } from '../lib/dates'
import { friendlyError } from '../lib/errors'
import { Loading, ErrorState, Empty, PageHeader, activityLabel, useLoad } from '../components/ui'

const WALLET_NAMES = { gcash: 'GCash', maya: 'Maya' }

// Payment checks: online bookings whose down payment still needs checking.
//  * "Awaiting verification": the guest typed their GCash / Maya reference and attached a receipt.
//    Look for the reference and amount in Goat Cliff's GCash / Maya history, then confirm the payment.
//    Not there? Reject it: the booking is cancelled and the slot opens again.
//  * "No payment proof submitted": older bookings from before the payment page (proof sent on Facebook).
//    Record the payment by hand, or cancel the unpaid booking.
// Guests still inside their 5-minute timer don't show here (they're still paying).
export default function Payments({ admin }) {
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const { data, error, loading, reload } = useLoad(() => listAwaitingPayment(admin), [])

  const q = search.trim().toLowerCase()
  const rows = (data || []).filter((b) => !q || [b.reference_number, b.guest_name, b.proof?.transaction_reference || '']
    .some((v) => v.toLowerCase().includes(q)))
  const withProof = rows.filter((b) => b.proof)
  const noProof = rows.filter((b) => !b.proof)

  function done(message) { setReceipt(message); setOpenId(null); reload() }

  return (
    <div>
      <PageHeader title="Payment checks" />
      <div className="filters">
        <label className="grow">Find a booking
          <input id="pay-search" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="GC- reference, guest name or payment reference" />
        </label>
      </div>
      {receipt && <p className="receipt" role="status">{receipt} <button className="link-button" onClick={() => setReceipt(null)}>OK</button></p>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && rows.length === 0 && <Empty text={q ? 'No booking matches that.' : 'Nothing to check right now.'} />}

      {withProof.length > 0 && (
        <>
          <h2>Awaiting verification ({withProof.length})</h2>
          <ul className="ledger panel">
            {withProof.map((b) => <ProofRow key={b.id} admin={admin} b={b} onDone={done} />)}
          </ul>
        </>
      )}

      {noProof.length > 0 && (
        <>
          <h2>No payment proof submitted ({noProof.length})</h2>
          <ul className="ledger panel">
            {noProof.map((b) => (
              <AwaitingRow key={b.id} admin={admin} b={b} open={openId === b.id}
                onToggle={() => setOpenId(openId === b.id ? null : b.id)} onDone={done} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// A booking where the guest sent their payment proof
function ProofRow({ admin, b, onDone }) {
  const p = b.proof
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)

  async function run(fn, message) {
    setError(''); setBusy(true)
    try { await fn(); onDone(message) } catch (e) { setError(friendlyError(e)); setBusy(false) }
  }

  async function openScreenshot() {
    setError('')
    try {
      const link = await receiptLink(p.receipt_path)
      window.open(link, '_blank', 'noopener')
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <li className="check-row open">
      <div className="ledger-row static">
        <span className="ledger-main">
          <strong><span className="ref-line inline">{b.reference_number}</span> {b.guest_name}</strong>
          <span className="muted"><Link to={`/bookings/${b.id}`}>{activityLabel(b.activity)} · {formatDate(b.visit_date)}</Link> · {b.group_size} people</span>
          <span className="status st-plain">
            {WALLET_NAMES[p.method] || p.method} reference no. <b className="pay-ref">{p.transaction_reference}</b> · submitted {sinceText(p.created_at)}
          </span>
        </span>
        <span className="due"><b>{pesoShort(p.amount)}</b><span>down payment</span></span>
      </div>

      <p className="muted">Check that this reference number and amount appear in Goat Cliff's {WALLET_NAMES[p.method] || ''} transaction history.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="actions-row wrap">
        {p.receipt_path
          ? <button type="button" className="btn-quiet" onClick={openScreenshot}>View receipt</button>
          : <span className="muted">No receipt attached</span>}
        {!confirmRelease && (
          <button type="button" className="btn-quiet danger" disabled={busy} onClick={() => setConfirmRelease(true)}>Reject payment</button>
        )}
        <button type="button" className="btn-primary" disabled={busy}
          onClick={() => run(() => confirmProof(admin, p), `Payment of ${peso(p.amount)} confirmed for ${b.guest_name} (${b.reference_number}).`)}>
          Confirm payment
        </button>
      </div>

      {confirmRelease && (
        <div className="confirm" role="alertdialog" aria-label="Reject this payment?">
          <p><strong>Reject this payment?</strong> The payment will be marked as rejected and {b.guest_name}'s booking for {activityLabel(b.activity)} on {formatDate(b.visit_date)} will be cancelled, so the slot becomes available to other guests. Only reject it if the reference number does not appear in Goat Cliff's {WALLET_NAMES[p.method] || ''} history.</p>
          <div className="actions-row">
            <button type="button" className="btn-quiet" onClick={() => setConfirmRelease(false)}>Go back</button>
            <button type="button" className="btn-danger" disabled={busy}
              onClick={() => run(() => rejectProof(admin, p), `Payment rejected. The slot held for ${b.guest_name} (${b.reference_number}) is available again.`)}>Reject payment</button>
          </div>
        </div>
      )}
    </li>
  )
}

// An older booking with no proof: record the payment by hand, or release the spot
function AwaitingRow({ admin, b, open, onToggle, onDone }) {
  const [amount, setAmount] = useState(String(b.amount_due))
  const [method, setMethod] = useState('gcash')
  const [txn, setTxn] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)

  async function run(fn, message) {
    setError(''); setBusy(true)
    try { await fn(); onDone(message) } catch (e) { setError(friendlyError(e)); setBusy(false) }
  }

  function record(e) {
    e.preventDefault()
    const clean = txn.replace(/\s/g, '')
    if (clean === '') return setError("Enter the reference number from the guest's receipt.")
    run(() => recordPayment(admin, b.id, { amount: Number(amount), purpose: 'down_payment', method, transaction_reference: clean }),
      `Recorded ${peso(Number(amount))} for ${b.guest_name} (${b.reference_number}), ${WALLET_NAMES[method]} ${clean}.`)
  }

  return (
    <li className={open ? 'check-row open' : 'check-row'}>
      <div className="ledger-row static">
        <span className="ledger-main">
          <strong><span className="ref-line inline">{b.reference_number}</span> {b.guest_name}</strong>
          <span className="muted"><Link to={`/bookings/${b.id}`}>{activityLabel(b.activity)} · {formatDate(b.visit_date)}</Link> · {b.group_size} people</span>
          <span className="status st-plain">Booked {sinceText(b.created_at)} · no payment proof submitted</span>
        </span>
        <span className="due">
          <b>{pesoShort(b.amount_due)}</b><span>down payment</span>
          {!open && <button className="btn-small" onClick={onToggle}>Record payment</button>}
        </span>
      </div>
      {open && (
        <form className="subform" onSubmit={record}>
          <div className="form-grid">
            <label>Amount received (₱)
              <input id={`amt-${b.id}`} type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label>Paid with
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
              </select>
            </label>
            <label>Reference number
              <input id={`txn-${b.id}`} autoFocus value={txn} onChange={(e) => setTxn(e.target.value)} maxLength={40} placeholder="From the guest's receipt" />
            </label>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="actions-row wrap">
            <button type="button" className="btn-quiet" onClick={onToggle}>Close</button>
            {!confirmRelease && (
              <button type="button" className="btn-quiet danger" disabled={busy} onClick={() => setConfirmRelease(true)}>Cancel unpaid booking</button>
            )}
            <button className="btn-primary" disabled={busy}>Save payment</button>
          </div>
          {confirmRelease && (
            <div className="confirm" role="alertdialog" aria-label="Cancel this unpaid booking?">
              <p><strong>Cancel this unpaid booking?</strong> {b.guest_name}'s booking for {activityLabel(b.activity)} on {formatDate(b.visit_date)} will be cancelled and the slot becomes available to other guests. Only do this if no payment was received.</p>
              <div className="actions-row">
                <button type="button" className="btn-quiet" onClick={() => setConfirmRelease(false)}>Go back</button>
                <button type="button" className="btn-danger" disabled={busy}
                  onClick={() => run(() => releaseUnpaid(admin, b.id), `Unpaid booking cancelled. The slot held for ${b.guest_name} (${b.reference_number}) is available again.`)}>Cancel booking</button>
              </div>
            </div>
          )}
        </form>
      )}
    </li>
  )
}

// "today at 3:40 PM", "yesterday", "3 days ago"
function sinceText(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today at ' + new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
  return days === 1 ? 'yesterday' : `${days} days ago`
}

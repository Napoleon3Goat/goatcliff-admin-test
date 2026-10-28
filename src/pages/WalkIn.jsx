import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActivities, createWalkIn, capacityFor } from '../lib/adminApi'
import { addDays, formatDate, peso, todayManila } from '../lib/dates'
import { isCamping, previewPrice, discountedCount } from '../lib/pricing'
import { friendlyError } from '../lib/errors'
import Counter from '../components/Counter'
import { Loading, ErrorState, PageHeader, useLoad } from '../components/ui'

const EMPTY = { name: '', contact: '', email: '', groupSize: 1, viewers: 0, seniors: 0, pwd: 0, children: 0, locals: 0 }

// For guests who arrive or call without booking online. Every walk-in must be entered
// so the online calendar stays accurate. No 2-day advance rule for walk-ins.
export default function WalkIn({ admin }) {
  const { data: activities, error, loading, reload } = useLoad(() => getActivities(), [])
  const [code, setCode] = useState('')
  const [date, setDate] = useState(todayManila())
  const [nights, setNights] = useState(1)
  const [form, setForm] = useState(EMPTY)
  const [paidNow, setPaidNow] = useState('')
  const [method, setMethod] = useState('cash')
  const [override, setOverride] = useState(false)
  const [consent, setConsent] = useState(false)
  const [cap, setCap] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)

  const activity = activities?.find((a) => a.code === code)
  const camping = activity ? isCamping(activity) : false

  useEffect(() => {
    setCap(null)
    if (activity && !camping && date) capacityFor(admin, activity, date).then(setCap).catch(() => setCap(null))
  }, [code, date, done])

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading) return <Loading />

  const set = (k) => (v) => setForm({ ...form, [k]: v })
  const price = activity ? previewPrice(activity, { ...form, nights }) : null
  const tooManyDiscounts = discountedCount({ ...form, children: camping ? form.children : 0 }) > form.groupSize
  const overCap = cap && !cap.closed && cap.booked + form.groupSize > cap.cap

  async function save(e) {
    e.preventDefault()
    setSaveError('')
    if (!activity) return setSaveError('Choose an activity.')
    if (!form.name.trim()) return setSaveError('Enter the guest\'s name.')
    if (!/^09\d{9}$/.test(form.contact.replace(/[\s-]/g, ''))) return setSaveError('Enter an 11-digit mobile number starting with 09.')
    if (tooManyDiscounts) return setSaveError('Each person can have only one discount.')
    if (!camping && form.viewers > form.groupSize) return setSaveError('Viewers can\'t be more than the group size.')
    setSaving(true)
    try {
      const b = await createWalkIn(admin, {
        activity, visit_date: date, nights: camping ? nights : null,
        form: { ...form, children: camping ? form.children : 0, viewers: camping ? 0 : form.viewers },
        paidNow: Number(paidNow) || 0, method, capacity_override: override,
        consent_given_at: consent ? new Date().toISOString() : null,
      })
      setDone(b)
    } catch (err) { setSaveError(friendlyError(err)) } finally { setSaving(false) }
  }

  if (done) {
    return (
      <div className="narrow">
        <div className="card center">
          <div className="check-mark">✓</div>
          <h1>Booking saved</h1>
          <p className="reference">{done.reference_number}</p>
          <p className="muted">{done.guest_name} · {activity ? (camping ? `Camping ${activity.code}` : activity.name) : ''} · {formatDate(done.visit_date)}</p>
          <div className="actions-row center">
            <Link to={`/bookings/${done.id}`} className="btn-quiet">Open booking</Link>
            <button className="btn-primary" onClick={() => { setDone(null); setForm(EMPTY); setPaidNow(''); setOverride(false); setConsent(false) }}>Add another walk-in</button>
          </div>
        </div>
      </div>
    )
  }

  const camps = (activities || []).filter(isCamping)
  const others = (activities || []).filter((a) => !isCamping(a))

  return (
    <div>
      <PageHeader title="New booking" />
      <form className="grid-2 align-start" onSubmit={save}>
        <div className="card form">
          <h2>Visit</h2>
          <label>Activity
            <select id="walkin-activity" value={code} onChange={(e) => { setCode(e.target.value); setOverride(false) }} required>
              <option value="">Choose…</option>
              <optgroup label="Rock">{others.map((a) => <option key={a.id} value={a.code}>{a.name}</option>)}</optgroup>
              <optgroup label="Camping">{camps.map((a) => <option key={a.id} value={a.code}>{a.code} · {a.area_group} · {peso(a.price)}/night</option>)}</optgroup>
            </select>
          </label>
          <label>{camping ? 'Check-in date' : 'Date'}
            <input id="walkin-date" type="date" value={date} min={todayManila()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          {camping && <Counter label="Nights" value={nights} onChange={setNights} min={1} max={14} />}
          {camping && <p className="hint">Check-out {formatDate(addDays(date, nights))}</p>}

          {activity && !camping && cap && (
            <div className={'capacity' + (cap.closed || overCap ? ' capacity-bad' : '')}>
              {cap.closed ? 'This day is closed.' : <>Already booked that day: <strong>{cap.booked}</strong> of {cap.cap}. After this group: <strong>{cap.booked + form.groupSize}</strong>.</>}
            </div>
          )}
          {activity && !camping && (overCap || override) && !cap?.closed && (
            <label className="check">
              <input id="walkin-override" type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              <span>Accept beyond the daily limit</span>
            </label>
          )}

          <h2>Group</h2>
          <Counter label="Group size" value={form.groupSize} onChange={set('groupSize')} min={1} max={200} />
          {!camping && <Counter label="Viewing only" value={form.viewers} onChange={set('viewers')} />}
          <Counter label="Senior citizens" value={form.seniors} onChange={set('seniors')} />
          <Counter label="PWDs" value={form.pwd} onChange={set('pwd')} />
          {camping && <Counter label="Children 7 and below" value={form.children} onChange={set('children')} />}
          <Counter label="Atok locals" value={form.locals} onChange={set('locals')} />
          {tooManyDiscounts && <p className="error">The discount counts add up to more than the group.</p>}
        </div>

        <div className="card form">
          <h2>Guest</h2>
          <label>Full name
            <input id="walkin-name" value={form.name} onChange={(e) => set('name')(e.target.value)} required />
          </label>
          <label>Mobile number
            <input id="walkin-contact" value={form.contact} onChange={(e) => set('contact')(e.target.value)} inputMode="tel" placeholder="09XX XXX XXXX" required />
          </label>
          <label>Email <span className="hint">(optional)</span>
            <input id="walkin-email" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
          </label>

          <h2>Payment</h2>
          {price ? (
            <div className="summary">
              {price.lines.map((l) => (
                <div className="summary-row" key={l.label}><span>{l.label}</span><span>{l.amount < 0 ? '−' + peso(-l.amount) : peso(l.amount)}</span></div>
              ))}
              <div className="summary-row total"><span>Total</span><span>{peso(price.total)}</span></div>
              <div className="summary-row"><span>Down payment (50%)</span><span>{peso(price.downPayment)}</span></div>
            </div>
          ) : null}
          <div className="form-grid">
            <label>Received now (₱)
              <input id="walkin-paid" type="number" min="0" step="0.01" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="0" />
            </label>
            <label>Method
              <select id="walkin-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
              </select>
            </label>
          </div>
          {price && (
            <div className="actions-row wrap">
              <button type="button" className="btn-quiet small" onClick={() => setPaidNow(String(price.downPayment))}>Down payment {peso(price.downPayment)}</button>
              <button type="button" className="btn-quiet small" onClick={() => setPaidNow(String(price.total))}>Full {peso(price.total)}</button>
            </div>
          )}
          <label className="check consent">
            <input id="walkin-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Agreed to Privacy Notice</span>
          </label>
          {saveError && <p className="error" role="alert">{saveError}</p>}
          <button className="btn-primary block" disabled={saving || !consent || cap?.closed || (overCap && !override)}>
            {saving ? 'Saving…' : 'Save walk-in'}
          </button>
        </div>
      </form>
    </div>
  )
}

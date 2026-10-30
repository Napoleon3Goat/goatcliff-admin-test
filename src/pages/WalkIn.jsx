import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActivities, createWalkIn, capacityFor, AGE_GROUPS, FOUND_VIA } from '../lib/adminApi'
import { addDays, formatDate, peso, todayManila } from '../lib/dates'
import { isCamping, isRock, previewPrice, discountedCount, TENTS } from '../lib/pricing'
import { friendlyError } from '../lib/errors'
import Counter from '../components/Counter'
import { Loading, ErrorState, PageHeader, useLoad } from '../components/ui'

const EMPTY = {
  name: '', contact: '', email: '', groupSize: 1, viewers: 0, seniors: 0, pwd: 0, children: 0, locals: 0,
  // Demo-only until the backend has columns for them (FR-15, FR-20, FR-29, FR-33)
  channel: 'walk_in', organizer: false, province: '', foundVia: '', emergencyName: '', emergencyContact: '',
  ages: Object.fromEntries(AGE_GROUPS.map((g) => [g, 0])), sexes: { male: 0, female: 0 }, tents4: 0, tents2: 0,
}
const CHANNELS = { walk_in: 'Walk-in', messenger: 'Messenger', phone: 'Phone' }
const sum = (o) => Object.values(o).reduce((t, n) => t + n, 0)
const mobile = (v) => /^09\d{9}$/.test(v.replace(/[\s-]/g, ''))

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
  const rock = activity ? isRock(activity) : false

  useEffect(() => {
    setCap(null)
    if (activity && !camping && date) capacityFor(admin, activity, date).then(setCap).catch(() => setCap(null))
  }, [code, date, done])

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading) return <Loading />

  const set = (k) => (v) => setForm({ ...form, [k]: v })
  const setIn = (k, key) => (v) => setForm({ ...form, [k]: { ...form[k], [key]: v } })
  const price = activity ? previewPrice(activity, { ...form, nights }) : null
  const tooManyDiscounts = !form.organizer && discountedCount(form) > form.groupSize
  const overCap = cap && !cap.closed && cap.booked + form.groupSize > cap.cap

  async function save(e) {
    e.preventDefault()
    setSaveError('')
    if (!activity) return setSaveError('Choose an activity.')
    if (!form.name.trim()) return setSaveError('Enter the guest\'s name.')
    if (!mobile(form.contact)) return setSaveError('Enter an 11-digit mobile number starting with 09.')
    if (tooManyDiscounts) return setSaveError('Each person can have only one discount.')
    if (rock && form.viewers > form.groupSize) return setSaveError('Viewers can\'t be more than the group size.')
    if (rock && form.children > form.viewers) return setSaveError('Children 7 and below can only join as viewers.')
    if (rock && (!form.emergencyName.trim() || !mobile(form.emergencyContact))) return setSaveError('Enter an emergency contact name and 11-digit mobile number.')
    if (sum(form.ages) !== form.groupSize) return setSaveError(`The age groups must add up to ${form.groupSize}.`)
    if (form.sexes.male + form.sexes.female !== form.groupSize) return setSaveError(`Male and female must add up to ${form.groupSize}.`)
    setSaving(true)
    try {
      const b = await createWalkIn(admin, {
        activity, visit_date: date, nights: camping ? nights : null,
        form: { ...form, viewers: rock ? form.viewers : 0, tents4: camping ? form.tents4 : 0, tents2: camping ? form.tents2 : 0 },
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
            <button className="btn-primary" onClick={() => { setDone(null); setForm(EMPTY); setPaidNow(''); setOverride(false); setConsent(false) }}>Add another booking</button>
          </div>
        </div>
      </div>
    )
  }

  const camps = (activities || []).filter(isCamping)
  const others = (activities || []).filter((a) => !isCamping(a))
  const groupName = (a) => a.category || a.area_group

  return (
    <div>
      <PageHeader title="New booking" />
      <form className="grid-2 align-start" onSubmit={save}>
        <div className="card form">
          <h2>Visit</h2>
          <label>Booked through
            <select id="walkin-channel" value={form.channel} onChange={(e) => set('channel')(e.target.value)}>
              {Object.entries(CHANNELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label>Activity
            <select id="walkin-activity" value={code} onChange={(e) => { setCode(e.target.value); setOverride(false) }} required>
              <option value="">Choose…</option>
              <optgroup label="Rock and viewing">{others.map((a) => <option key={a.id} value={a.code}>{a.name}</option>)}</optgroup>
              <optgroup label="Camping">{camps.map((a) => <option key={a.id} value={a.code}>{a.code} · {groupName(a)} · {peso(a.price)}/night</option>)}</optgroup>
            </select>
          </label>
          <label>{camping ? 'Check-in date' : 'Date'}
            <input id="walkin-date" type="date" value={date} min={todayManila()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          {camping && <Counter label="Nights" value={nights} onChange={setNights} min={1} max={14} />}
          {camping && <p className="hint">Check-in 1:00–6:00 PM · check-out {formatDate(addDays(date, nights))}, 12:00 noon</p>}

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
          {rock && <Counter label="Viewing only" value={form.viewers} onChange={set('viewers')} />}
          <label className="check">
            <input id="walkin-organizer" type="checkbox" checked={form.organizer} onChange={(e) => set('organizer')(e.target.checked)} />
            <span>Organizer booking (20% off the whole group)</span>
          </label>
          {!form.organizer && (
            <>
              <Counter label="Senior citizens" value={form.seniors} onChange={set('seniors')} />
              <Counter label="PWDs" value={form.pwd} onChange={set('pwd')} />
              <Counter label="Children 7 and below" hint={rock ? 'Viewing only' : undefined} value={form.children} onChange={set('children')} />
              <Counter label="Atok locals" value={form.locals} onChange={set('locals')} />
            </>
          )}
          {tooManyDiscounts && <p className="error">The discount counts add up to more than the group.</p>}

          <h3>Ages</h3>
          <div className="counter-grid">
            {AGE_GROUPS.map((g) => <Counter key={g} label={g} value={form.ages[g]} onChange={setIn('ages', g)} max={200} />)}
          </div>
          <p className={sum(form.ages) === form.groupSize ? 'hint' : 'hint warn-text'}>{sum(form.ages)} of {form.groupSize}</p>
          <h3>Sex</h3>
          <div className="counter-grid">
            <Counter label="Male" value={form.sexes.male} onChange={setIn('sexes', 'male')} max={200} />
            <Counter label="Female" value={form.sexes.female} onChange={setIn('sexes', 'female')} max={200} />
          </div>
          <p className={form.sexes.male + form.sexes.female === form.groupSize ? 'hint' : 'hint warn-text'}>{form.sexes.male + form.sexes.female} of {form.groupSize}</p>

          {camping && (
            <>
              <h3>Tent rental</h3>
              {Object.entries(TENTS).map(([key, t]) => (
                <Counter key={key} label={`${t.label} · ${peso(t.price)}`} value={form[key]} onChange={set(key)} max={t.stock} />
              ))}
            </>
          )}
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
          <div className="form-grid">
            <label>Province <span className="hint">(optional)</span>
              <input id="walkin-province" value={form.province} onChange={(e) => set('province')(e.target.value)} />
            </label>
            <label>Found Goatcliff via <span className="hint">(optional)</span>
              <select id="walkin-found" value={form.foundVia} onChange={(e) => set('foundVia')(e.target.value)}>
                <option value="">Choose…</option>
                {FOUND_VIA.map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
          </div>
          {rock && (
            <>
              <h2>Emergency contact</h2>
              <div className="form-grid">
                <label>Name
                  <input id="walkin-em-name" value={form.emergencyName} onChange={(e) => set('emergencyName')(e.target.value)} />
                </label>
                <label>Mobile number
                  <input id="walkin-em-contact" value={form.emergencyContact} onChange={(e) => set('emergencyContact')(e.target.value)} inputMode="tel" placeholder="09XX XXX XXXX" />
                </label>
              </div>
            </>
          )}

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
            <span>Agreed to the Privacy Notice, Booking Terms and waiver</span>
          </label>
          {saveError && <p className="error" role="alert">{saveError}</p>}
          <button className="btn-primary block" disabled={saving || !consent || cap?.closed || (overCap && !override)}>
            {saving ? 'Saving…' : 'Save booking'}
          </button>
        </div>
      </form>
    </div>
  )
}

// EVERY admin call to the backend goes through this file.
// REAL  = already reads Supabase.
// MOCK  = uses demo data kept in this browser, until the backend's access rules and functions exist.
// When a backend piece is ready, replace only that function here; the pages stay the same.
//
// Column names match the backend tables (supabase/migrations/..._baseline.sql), so the swap is small.
import { supabase } from './supabase'
import { addDays, todayManila } from './dates'
import { isCamping, previewPrice } from './pricing'

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(16).slice(2))
const ref = () => 'GC-' + Math.random().toString(16).slice(2, 10).toUpperCase()

// ---------- REAL: activities (public read rule already exists) ----------

let activityCache = null
export async function getActivities({ includeHidden = false } = {}) {
  if (!activityCache) {
    const { data, error } = await supabase.from('activities').select('*').order('code')
    if (error) throw error
    activityCache = [...(data || []), ...(store().addedActivities || [])]
  }
  const list = activityCache.map((a) => ({ ...a, ...(store().activityEdits[a.id] || {}) }))
  return includeHidden ? list : list.filter((a) => a.is_active)
}

// ---------- MOCK store ----------
// Kept in localStorage so demo changes survive a refresh. "Reset demo data" on the Dashboard clears it.

const KEY = 'goatcliff-admin-demo-v3'
let memory = null

function store() {
  if (memory) return memory
  try { memory = JSON.parse(localStorage.getItem(KEY)) } catch { memory = null }
  if (!memory) memory = { seeded: false, bookings: [], payments: [], cancellations: [], overrides: [], staff: [], activityEdits: {} }
  return memory
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)) } catch { /* storage blocked: fine for a demo */ }
}
export function resetDemoData() {
  memory = null
  activityCache = null
  try { localStorage.removeItem(KEY) } catch {}
}

// Builds believable sample data the first time, using the real activity list.
// Only one seeding runs at a time, even if several pages ask at once.
let seeding = null
function ready(admin) {
  if (store().seeded) return Promise.resolve(store())
  if (!seeding) seeding = seed(admin).finally(() => { seeding = null })
  return seeding
}

async function seed(admin) {
  const s = store()
  const acts = await getActivities({ includeHidden: true })
  const byCode = Object.fromEntries(acts.map((a) => [a.code, a]))
  const today = todayManila()
  const me = admin?.id || 'me'

  s.staff = [
    { id: me, name: admin?.name || 'You', role: admin?.role || 'super_admin', email: 'you@goatcliff.ph', is_active: true, created_at: new Date().toISOString() },
    { id: 'staff-ana', name: 'Ana Bautista', role: 'staff_admin', email: 'ana@goatcliff.ph', is_active: true, created_at: new Date().toISOString() },
    { id: 'field-jun', name: 'Jun Carino', role: 'field_staff', email: 'jun@goatcliff.ph', is_active: true, created_at: new Date().toISOString() },
    { id: 'field-mika', name: 'Mika Dalisay', role: 'field_staff', email: 'mika@goatcliff.ph', is_active: true, created_at: new Date().toISOString() },
  ]

  const names = ['Lee Dimog', 'Kieffer Bulahao', 'Jem Danganan', 'Maria Santos', 'Paolo Reyes', 'Carla Lim', 'Rafael Tan',
    'Bea Villanueva', 'Joshua Cruz', 'Andrea Gomez', 'Miguel Ramos', 'Trisha Navarro', 'Nico Fernandez', 'Ella Mendoza',
    'Marco Aquino', 'Sofia Torres', 'Gab Castillo', 'Ivy Domingo', 'Kyle Ocampo', 'Rina Pascual', 'Leo Salazar', 'Pia Herrera']
  // [days from today, code, nights, group, viewers, seniors, pwd, children, locals, payment, attendance, source, field staff]
  const plan = [
    [-9, 'LA1', 2, 4, 0, 1, 0, 0, 0, 'paid', 'done', 'online', null],
    [-8, 'ROCK', null, 6, 1, 0, 0, 0, 0, 'paid', 'done', 'online', 'field-jun'],
    [-6, 'UA3', 1, 3, 0, 0, 1, 0, 0, 'paid', 'done', 'walk_in', null],
    [-5, 'ROCK', null, 4, 0, 1, 0, 0, 1, 'down_payment', 'failed_to_show', 'online', 'field-mika'],
    [-4, 'CA1', 1, 5, 0, 0, 0, 2, 0, 'paid', 'done', 'online', null],
    [-3, 'ROCK', null, 9, 2, 0, 0, 0, 0, 'paid', 'done', 'online', 'field-jun'],
    [-2, 'UT', 1, 2, 0, 0, 0, 0, 0, 'expired', 'cancelled', 'online', null],
    [-1, 'LA3', 2, 4, 0, 0, 0, 1, 0, 'paid', 'done', 'online', null],
    [0, 'ROCK', null, 18, 2, 1, 0, 0, 0, 'down_payment', 'upcoming', 'online', 'field-jun'],
    [0, 'ROCK', null, 14, 0, 0, 1, 0, 2, 'down_payment', 'upcoming', 'online', 'field-mika'],
    [0, 'LA2', 1, 6, 0, 2, 0, 0, 0, 'down_payment', 'upcoming', 'online', null],
    [0, 'CA3', 2, 3, 0, 0, 0, 1, 0, 'paid', 'upcoming', 'walk_in', null],
    [1, 'ROCK', null, 26, 3, 0, 0, 0, 0, 'pending', 'upcoming', 'online', 'field-jun'],
    [1, 'UA4', 1, 4, 0, 0, 0, 0, 4, 'down_payment', 'upcoming', 'online', null],
    [2, 'ROCK', null, 22, 0, 2, 0, 0, 0, 'pending', 'upcoming', 'online', null],
    [3, 'LA4', 3, 5, 0, 1, 1, 1, 0, 'pending', 'upcoming', 'online', null],
    [3, 'ROCK', null, 48, 4, 0, 0, 0, 0, 'down_payment', 'upcoming', 'online', 'field-mika'],
    [4, 'CA2', 2, 4, 0, 0, 0, 0, 0, 'pending', 'upcoming', 'online', null],
    [5, 'ROCK', null, 62, 1, 0, 1, 0, 0, 'down_payment', 'upcoming', 'online', null],
    [6, 'UA5', 1, 2, 0, 0, 0, 0, 0, 'down_payment', 'upcoming', 'online', null],
    [8, 'ROCK', null, 34, 2, 1, 0, 0, 0, 'down_payment', 'upcoming', 'online', null],
    [4, 'ROCK', null, 80, 6, 0, 0, 0, 0, 'down_payment', 'upcoming', 'walk_in', null],
    [6, 'ROCK', null, 27, 0, 0, 0, 0, 0, 'down_payment', 'upcoming', 'online', null],
    [11, 'ROCK', null, 41, 3, 0, 0, 0, 0, 'down_payment', 'upcoming', 'online', null],
    [12, 'LA1', 2, 6, 0, 0, 0, 2, 0, 'down_payment', 'upcoming', 'online', null],
  ]
  const now = Date.now()
  plan.forEach(([d, code, nights, group, viewers, seniors, pwd, children, locals, pay, att, source, field], i) => {
    const a = byCode[code]
    if (!a) return
    const form = { groupSize: group, viewers, seniors, pwd, children, locals, nights: nights || 1 }
    const price = previewPrice(a, form)
    const b = {
      id: uid(), reference_number: ref(), activity_id: a.id, visit_date: addDays(today, d), nights,
      guest_name: names[i % names.length], companions_names: [], contact_number: '0917' + String(1000000 + i * 7919).slice(-7),
      email: names[i % names.length].toLowerCase().replace(/[^a-z]+/g, '.') + '@gmail.com',
      group_size: group, viewing_count: viewers, senior_count: seniors, pwd_count: pwd, child_count: children, local_count: locals,
      total_amount: price.total, amount_due: price.downPayment, amount_paid: 0,
      payment_status: pay, attendance_status: att, source, assigned_field_staff_id: field, capacity_override: false,
      // Pending online bookings: some still inside the 15-minute hold, some already ended
      hold_expires_at: pay === 'pending' ? new Date(now + (i % 2 ? 9 : -90) * 60000).toISOString() : null,
      consent_given_at: new Date(now - (30 - i) * 36e5).toISOString(),
      created_by: source === 'walk_in' ? 'staff-ana' : null,
      created_at: new Date(Date.parse(addDays(today, Math.min(d, 0) - 5 + (i % 4)) + 'T0' + (8 + (i % 2)) + ':15:00+08:00')).toISOString(),
    }
    s.bookings.push(b)
    const method = source === 'walk_in' ? 'cash' : 'gcash'
    if (['down_payment', 'paid'].includes(pay)) addPaymentRow(s, b, price.downPayment, 'down_payment', method, 'confirmed', i % 3 ? me : 'staff-ana')
    if (pay === 'paid') addPaymentRow(s, b, price.total - price.downPayment, 'balance', 'cash', 'confirmed', 'staff-ana')
  })
  // One past cancellation and one upcoming closed day, so those pages aren't empty.
  const cancelled = s.bookings.find((b) => b.attendance_status === 'cancelled')
  if (cancelled) {
    s.cancellations.push({ id: uid(), booking_id: cancelled.id, action: 'cancel', reason_category: 'guest_request', reason_details: 'Hold expired; guest did not pay.', original_visit_date: cancelled.visit_date, new_visit_date: null, refund_amount: null, refund_status: 'not_applicable', processed_by: 'staff-ana', guest_notified_at: new Date().toISOString(), created_at: new Date().toISOString() })
  }
  if (byCode.ROCK) {
    s.overrides.push({ id: uid(), activity_id: byCode.ROCK.id, override_date: addDays(today, 10), daily_capacity: 60, is_closed: false, reason: 'Fewer guides available', set_by: 'staff-ana', created_at: new Date().toISOString() })
  }
  s.seeded = true
  save()
  return s
}

function addPaymentRow(s, b, amount, purpose, method, status, recordedBy, txn = null) {
  const p = {
    id: uid(), booking_id: b.id, amount: Math.round(amount * 100) / 100, purpose, method, status,
    transaction_reference: txn, recorded_by: recordedBy, paid_at: status === 'confirmed' ? new Date().toISOString() : null,
    created_at: new Date().toISOString(), void_reason: null,
  }
  s.payments.push(p)
  recomputePaid(s, b)
  return p
}

// amount_paid and payment_status follow the confirmed payments (voided ones don't count).
function recomputePaid(s, b) {
  const paid = s.payments.filter((p) => p.booking_id === b.id && p.status === 'confirmed').reduce((t, p) => t + Number(p.amount), 0)
  b.amount_paid = Math.round(paid * 100) / 100
  if (['refunded', 'expired'].includes(b.payment_status)) return
  if (paid >= b.total_amount - 0.005) b.payment_status = 'paid'
  else if (paid >= b.amount_due - 0.005) b.payment_status = 'down_payment'
  else if (b.payment_status !== 'pending') b.payment_status = 'pending'
}

function staffName(s, id) {
  return s.staff.find((x) => x.id === id)?.name || (id ? 'Admin' : '—')
}

async function withActivities(rows) {
  const acts = await getActivities({ includeHidden: true })
  const byId = Object.fromEntries(acts.map((a) => [a.id, a]))
  return rows.map((b) => ({ ...b, activity: byId[b.activity_id] || null }))
}

// ---------- MOCK: bookings ----------

export async function listBookings(admin, { from, to, status, type, search } = {}) {
  const s = await ready(admin); await wait()
  let rows = s.bookings.slice()
  if (from) rows = rows.filter((b) => lastDay(b) >= from)
  if (to) rows = rows.filter((b) => b.visit_date <= to)
  if (status) rows = rows.filter((b) => b.payment_status === status || b.attendance_status === status)
  rows = await withActivities(rows)
  if (type) rows = rows.filter((b) => (type === 'camping') === isCamping(b.activity || {}))
  if (search) {
    const q = search.trim().toLowerCase()
    rows = rows.filter((b) => [b.reference_number, b.guest_name, b.email, b.contact_number, b.activity?.code].some((v) => String(v || '').toLowerCase().includes(q)))
  }
  return rows.sort((a, b) => a.visit_date.localeCompare(b.visit_date) || a.created_at.localeCompare(b.created_at))
}

// Last night of a camping stay (or the visit date for rock).
export function lastDay(b) {
  return b.nights ? addDays(b.visit_date, b.nights - 1) : b.visit_date
}

export async function getBooking(admin, id) {
  const s = await ready(admin); await wait()
  const b = s.bookings.find((x) => x.id === id)
  if (!b) return null
  const [withAct] = await withActivities([b])
  return {
    ...withAct,
    field_staff_name: b.assigned_field_staff_id ? staffName(s, b.assigned_field_staff_id) : null,
    created_by_name: b.created_by ? staffName(s, b.created_by) : null,
    payments: s.payments.filter((p) => p.booking_id === id).map((p) => ({ ...p, recorded_by_name: p.recorded_by ? staffName(s, p.recorded_by) : 'Guest (online)' }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    cancellations: s.cancellations.filter((c) => c.booking_id === id).map((c) => ({ ...c, processed_by_name: staffName(s, c.processed_by) })),
  }
}

export async function recordPayment(admin, bookingId, { amount, purpose, method, transaction_reference }) {
  const s = await ready(admin); await wait()
  const b = s.bookings.find((x) => x.id === bookingId)
  if (!b) throw new Error('Booking not found')
  if (!(amount > 0)) throw new Error('Enter an amount greater than zero.')
  addPaymentRow(s, b, amount, purpose, method, 'confirmed', admin.id, transaction_reference || null)
  save()
}

export async function setAttendance(admin, bookingId, attendance) {
  const s = await ready(admin); await wait()
  const b = s.bookings.find((x) => x.id === bookingId)
  if (!b) throw new Error('Booking not found')
  b.attendance_status = attendance
  save()
}

export async function assignFieldStaff(admin, bookingId, staffId) {
  const s = await ready(admin); await wait()
  const b = s.bookings.find((x) => x.id === bookingId)
  b.assigned_field_staff_id = staffId || null
  save()
}

// ---------- MOCK: payments waiting to be recorded ----------
// This semester guests send their GCash receipt to the Facebook Page; an admin finds the
// booking by reference and records the payment. ("for_verification" comes in January.)

export async function listAwaitingPayment(admin) {
  const s = await ready(admin); await wait()
  const rows = await withActivities(s.bookings.filter((b) => b.payment_status === 'pending' && b.attendance_status !== 'cancelled'))
  const now = Date.now()
  return rows.map((b) => ({ ...b, hold_ended: b.hold_expires_at ? new Date(b.hold_expires_at).getTime() < now : false }))
    .sort((a, b) => String(a.hold_expires_at).localeCompare(String(b.hold_expires_at)))
}

// Frees the spot of an unpaid booking whose hold ended (automatic job is planned: C6).
export async function releaseUnpaid(admin, bookingId) {
  const s = await ready(admin); await wait()
  const b = s.bookings.find((x) => x.id === bookingId)
  b.payment_status = 'expired'
  save()
}

// ---------- MOCK: walk-ins ----------

export async function capacityFor(admin, activity, date) {
  const s = await ready(admin)
  const o = s.overrides.find((x) => x.activity_id === activity.id && x.override_date === date)
  if (o?.is_closed) return { closed: true, cap: 0, booked: 0 }
  const cap = o?.daily_capacity ?? activity.daily_capacity ?? 80
  const booked = s.bookings.filter((b) => b.activity_id === activity.id && b.visit_date === date && b.attendance_status !== 'cancelled' && b.payment_status !== 'expired')
    .reduce((t, b) => t + b.group_size, 0)
  return { closed: false, cap, booked }
}

export async function createWalkIn(admin, { activity, visit_date, nights, form, paidNow, method, capacity_override, consent_given_at }) {
  const s = await ready(admin); await wait(400)
  if (!consent_given_at) throw new Error('Tick that the guest agreed in person to the Privacy Notice and Booking Terms.')
  const camping = isCamping(activity)
  // Same rules the database enforces, checked here so the admin sees a clear message.
  const nightsList = camping ? Array.from({ length: nights }, (_, i) => addDays(visit_date, i)) : [visit_date]
  for (const d of nightsList) {
    if (s.overrides.some((o) => (o.activity_id === activity.id || o.activity_id === 'ALL') && o.override_date === d && o.is_closed)) throw new Error('DATE_CLOSED')
  }
  if (camping) {
    const clash = s.bookings.find((b) => b.activity_id === activity.id && b.attendance_status !== 'cancelled' && b.payment_status !== 'expired'
      && nightsList.some((d) => d >= b.visit_date && d <= lastDay(b)))
    if (clash) throw new Error('no_double_booking_camping')
  } else if (!capacity_override) {
    const { cap, booked } = await capacityFor(admin, activity, visit_date)
    if (booked + form.groupSize > cap) throw new Error('DAY_FULL')
  }
  const price = previewPrice(activity, { ...form, nights: nights || 1 })
  const b = {
    id: uid(), reference_number: ref(), activity_id: activity.id, visit_date, nights: camping ? nights : null,
    guest_name: form.name.trim(), companions_names: [], contact_number: form.contact.replace(/[\s-]/g, ''), email: form.email.trim() || 'walk-in@goatcliff.ph',
    group_size: form.groupSize, viewing_count: camping ? 0 : form.viewers, senior_count: form.seniors, pwd_count: form.pwd,
    child_count: camping ? form.children : 0, local_count: form.locals,
    total_amount: price.total, amount_due: price.downPayment, amount_paid: 0, payment_status: 'pending', attendance_status: 'upcoming',
    source: 'walk_in', assigned_field_staff_id: null, capacity_override: !!capacity_override, hold_expires_at: null, created_at: new Date().toISOString(),
    consent_given_at, created_by: admin.id, // in the database a trigger fills created_by (C13)
  }
  s.bookings.push(b)
  // Money received at the counter: first counts as the down payment, anything above it as balance.
  if (paidNow > 0) {
    const down = Math.min(paidNow, price.downPayment)
    addPaymentRow(s, b, down, 'down_payment', method, 'confirmed', admin.id)
    if (paidNow > down) addPaymentRow(s, b, paidNow - down, 'balance', method, 'confirmed', admin.id)
  }
  save()
  return b
}

// ---------- MOCK: cancellations, reschedules, refunds ----------

export const REASONS = {
  weather: 'Bad weather',
  health_emergency: 'Health emergency',
  death: 'Death in the family',
  guest_request: 'Guest request (personal reason)',
  other: 'Other',
}

export async function processCancellation(admin, bookingId, { action, reason_category, reason_details, new_visit_date, refund_amount }) {
  const s = await ready(admin); await wait(400)
  const b = s.bookings.find((x) => x.id === bookingId)
  if (!b) throw new Error('Booking not found')
  if (action === 'reschedule') {
    if (!new_visit_date) throw new Error('Pick the new date.')
    if (new_visit_date > addDays(b.visit_date, 183)) throw new Error('Reschedules must be within 6 months of the original date.')
  }
  if (action === 'refund' && !(refund_amount > 0)) throw new Error('Enter the refund amount.')
  s.cancellations.push({
    id: uid(), booking_id: b.id, action, reason_category, reason_details: reason_details?.trim() || null,
    original_visit_date: b.visit_date, new_visit_date: action === 'reschedule' ? new_visit_date : null,
    refund_amount: action === 'refund' ? refund_amount : null, refund_status: action === 'refund' ? 'pending' : 'not_applicable',
    processed_by: admin.id, guest_notified_at: null, created_at: new Date().toISOString(),
  })
  if (action === 'reschedule') { b.visit_date = new_visit_date; b.attendance_status = 'upcoming' }
  else { b.attendance_status = 'cancelled'; if (action === 'refund') b.payment_status = 'refunded' }
  save()
}

export async function listCancellations(admin) {
  const s = await ready(admin); await wait()
  const acts = Object.fromEntries((await getActivities({ includeHidden: true })).map((a) => [a.id, a]))
  return s.cancellations.map((c) => {
    const b = s.bookings.find((x) => x.id === c.booking_id) || {}
    return { ...c, booking: b, activity: acts[b.activity_id], processed_by_name: staffName(s, c.processed_by) }
  }).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function markRefundProcessed(admin, cancellationId) {
  const s = await ready(admin); await wait()
  const c = s.cancellations.find((x) => x.id === cancellationId)
  c.refund_status = 'processed'
  save()
}

export async function markGuestNotified(admin, cancellationId) {
  const s = await ready(admin); await wait()
  const c = s.cancellations.find((x) => x.id === cancellationId)
  c.guest_notified_at = new Date().toISOString()
  save()
}

// ---------- MOCK: date controls ----------

export async function listOverrides(admin) {
  const s = await ready(admin); await wait()
  const acts = Object.fromEntries((await getActivities({ includeHidden: true })).map((a) => [a.id, a]))
  // Rows saved together with "All activities" are shown as one entry.
  const out = []
  const seen = new Set()
  for (const o of s.overrides) {
    if (o.group_id) {
      if (seen.has(o.group_id)) continue
      seen.add(o.group_id)
      out.push({ ...o, id: o.group_id, activity: null, all: true, set_by_name: staffName(s, o.set_by) })
    } else {
      out.push({ ...o, activity: acts[o.activity_id] || null, set_by_name: staffName(s, o.set_by) })
    }
  }
  return out.sort((a, b) => a.override_date.localeCompare(b.override_date))
}

// activity_id 'ALL' closes every activity that day (one row per activity in the real database).
export async function saveOverride(admin, { activity_id, override_date, is_closed, daily_capacity, reason }) {
  const s = await ready(admin); await wait(400)
  if (!override_date) throw new Error('Pick a date.')
  if (!reason?.trim()) throw new Error('Write a reason (only admins see it).')
  if (!is_closed && !(daily_capacity >= 0)) throw new Error('Enter the new daily cap.')
  const ids = activity_id === 'ALL' ? (await getActivities()).map((a) => a.id) : [activity_id]
  const group_id = activity_id === 'ALL' ? uid() : null
  for (const id of ids) {
    // One row per activity and date: change it if it exists (no deleting), otherwise add it.
    const existing = s.overrides.find((o) => o.activity_id === id && o.override_date === override_date)
    const fields = { is_closed, daily_capacity: is_closed ? null : daily_capacity, reason: reason.trim(), set_by: admin.id }
    if (existing) Object.assign(existing, fields, group_id ? { group_id } : {})
    else s.overrides.push({ id: uid(), group_id, activity_id: id, override_date, ...fields, created_at: new Date().toISOString() })
  }
  save()
  // Bookings already on that date, so the admin can reschedule or refund each one.
  return (await listBookings(admin, { from: override_date, to: override_date }))
    .filter((b) => (activity_id === 'ALL' || b.activity_id === activity_id) && b.attendance_status === 'upcoming')
}

// ---------- MOCK: activities (editing) ----------
// Reading is REAL. Saving needs a backend rule that lets the Super Admin edit activities.
export async function updateActivity(admin, id, fields) {
  const s = await ready(admin); await wait(400)
  if (admin.role !== 'super_admin') throw new Error('Only the Super Admin can edit activities.')
  s.activityEdits[id] = { ...(s.activityEdits[id] || {}), ...fields }
  save()
}

export async function createActivity(admin, f) {
  const s = await ready(admin); await wait(400)
  if (admin.role !== 'super_admin') throw new Error('Only the Super Admin can add activities.')
  const code = f.code.trim().toUpperCase()
  if (!code || !f.name.trim()) throw new Error('Enter a code and a name.')
  if ((await getActivities({ includeHidden: true })).some((a) => a.code === code)) throw new Error('That code is already used.')
  if (!(Number(f.price) >= 0) || f.price === '') throw new Error('Enter the price.')
  const camping = f.type === 'camping'
  const row = {
    id: uid(), code, name: f.name.trim(), type: f.type, area_group: camping ? f.area_group.trim() || null : null,
    description: f.description.trim() || null, price: Number(f.price), price_unit: camping ? 'per_night' : 'per_person',
    per_person_price: camping ? Number(f.per_person_price || 0) : 0, viewing_price: camping || f.viewing_price === '' ? null : Number(f.viewing_price),
    min_age: camping || f.min_age === '' ? null : Number(f.min_age), capacity: null,
    daily_capacity: camping || f.daily_capacity === '' ? null : Number(f.daily_capacity),
    down_payment_percent: 50, requires_down_payment: true, advance_notice_days: 2, is_active: true, created_at: new Date().toISOString(),
  }
  activityCache.push(row)
  s.addedActivities = [...(s.addedActivities || []), row]
  save()
}

// ---------- MOCK: staff accounts ----------
// Creating real logins needs a backend Edge Function (it uses the secret key, which never goes in the frontend).
export async function listStaff(admin) {
  const s = await ready(admin); await wait()
  return s.staff.slice().sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name))
}

export async function createStaff(admin, { name, email, role }) {
  const s = await ready(admin); await wait(400)
  if (!name.trim()) throw new Error('Enter the staff member\'s name.')
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter a valid email. They sign in with it.')
  if (s.staff.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('Someone already uses that email.')
  s.staff.push({ id: uid(), name: name.trim(), email: email.trim(), role, is_active: true, created_at: new Date().toISOString() })
  save()
}

export async function updateStaff(admin, id, fields) {
  const s = await ready(admin); await wait()
  const target = s.staff.find((x) => x.id === id)
  const losingSuper = target.role === 'super_admin' && (fields.is_active === false || (fields.role && fields.role !== 'super_admin'))
  const supers = s.staff.filter((x) => x.role === 'super_admin' && x.is_active)
  // FR-31: at least one active Super Admin must always remain
  if (losingSuper && supers.length <= 1) throw new Error('There must always be at least one active Super Admin. Promote someone else first.')
  if (id === admin.id && losingSuper) throw new Error('Ask another Super Admin to change your own account.')
  Object.assign(s.staff.find((x) => x.id === id), fields)
  save()
}

export async function listFieldStaff(admin) {
  return (await listStaff(admin)).filter((x) => x.role === 'field_staff' && x.is_active)
}

// ---------- MOCK: Field Staff ----------
// Only safe columns: no amounts or payment status (matches the planned "Field Staff view").
export async function listMyGroups(admin) {
  // Since the Oct 25 interview: guides rotate by station, so every Field Staff sees all groups.
  const s = await ready(admin); await wait()
  const rows = await withActivities(s.bookings.filter((b) => b.attendance_status !== 'cancelled' && b.payment_status !== 'expired'))
  return rows.map((b) => ({
    id: b.id, reference_number: b.reference_number, visit_date: b.visit_date, nights: b.nights, activity: b.activity,
    guest_name: b.guest_name, contact_number: b.contact_number, group_size: b.group_size, viewing_count: b.viewing_count,
    senior_count: b.senior_count, pwd_count: b.pwd_count, child_count: b.child_count, attendance_status: b.attendance_status,
  })).sort((a, b) => a.visit_date.localeCompare(b.visit_date))
}

// ---------- MOCK: dashboard & analytics ----------

export async function dashboardSummary(admin) {
  const s = await ready(admin)
  const today = todayManila()
  const all = await listBookings(admin)
  const live = all.filter((b) => b.attendance_status !== 'cancelled' && b.payment_status !== 'expired')
  const todays = live.filter((b) => b.visit_date <= today && lastDay(b) >= today)
  const rock = (await getActivities()).find((a) => !isCamping(a))
  const rockCap = rock ? await capacityFor(admin, rock, today) : null
  return {
    today,
    todays,
    arrivingToday: todays.filter((b) => b.visit_date === today),
    peopleToday: todays.reduce((t, b) => t + b.group_size, 0),
    awaiting: live.filter((b) => b.payment_status === 'pending' && b.source === 'online').length,
    holdsEnded: live.filter((b) => b.payment_status === 'pending' && b.hold_expires_at && new Date(b.hold_expires_at) < new Date()).length,
    rockCap,
    upcoming: live.filter((b) => b.visit_date > today && b.visit_date <= addDays(today, 7)),
    // Rock headcount for the next 14 days (the elevation profile on the Today page)
    profile: rock ? await Promise.all(Array.from({ length: 14 }, async (_, i) => {
      const date = addDays(today, i)
      return { date, ...(await capacityFor(admin, rock, date)) }
    })) : [],
    // Which camping areas have someone staying tonight
    campingTonight: (await getActivities({ includeHidden: true })).filter(isCamping).map((a) => {
      const b = live.find((x) => x.activity_id === a.id && x.visit_date <= today && lastDay(x) >= today)
      return { area: a, booking: b || null, arriving: !!b && b.visit_date === today }
    }),
  }
}

export async function analytics(admin, { from, to }) {
  const rows = (await listBookings(admin, { from, to })).filter((b) => b.payment_status !== 'expired')
  const counted = rows.filter((b) => b.attendance_status !== 'cancelled')
  const byActivity = {}
  for (const b of counted) {
    const key = b.activity ? (isCamping(b.activity) ? b.activity.code : b.activity.name) : 'Unknown'
    byActivity[key] = (byActivity[key] || 0) + 1
  }
  const byWeekday = [0, 0, 0, 0, 0, 0, 0]
  for (const b of counted) byWeekday[new Date(b.visit_date + 'T00:00:00Z').getUTCDay()] += b.group_size
  const people = counted.reduce((t, b) => t + b.group_size, 0)
  const sum = (k) => counted.reduce((t, b) => t + (b[k] || 0), 0)
  return {
    bookings: counted.length,
    people,
    revenue: counted.reduce((t, b) => t + Number(b.amount_paid), 0),
    cancelled: rows.length - counted.length,
    noShows: counted.filter((b) => b.attendance_status === 'failed_to_show').length,
    walkIns: counted.filter((b) => b.source === 'walk_in').length,
    byActivity: Object.entries(byActivity).sort((a, b) => b[1] - a[1]),
    byWeekday,
    groups: { seniors: sum('senior_count'), pwd: sum('pwd_count'), children: sum('child_count'), locals: sum('local_count'), viewers: sum('viewing_count') },
  }
}

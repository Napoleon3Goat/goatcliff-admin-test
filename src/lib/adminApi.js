// EVERY admin call to the backend goes through this file. All of it talks to Supabase.
// The database's access rules decide what each role may read or change; this file only asks.
//
// Pages use a few friendly names for the Nov 3 columns (age_counts, sex_counts, channel, ...).
// `shape()` below turns a database row into that form, and `walkInRow()` turns the form back into columns.
import { supabase } from './supabase'
import { addDays, todayManila } from './dates'
import { isCamping, isRock, previewPrice } from './pricing'

const must = ({ data, error }) => { if (error) throw error; return data }

// ---------- names used on the screens <-> database values ----------

export const AGE_GROUPS = ['0–7', '8–17', '18–24', '25–34', '35–44', '45–59', '60+']
const AGE_COLS = ['age_0_7', 'age_8_17', 'age_18_24', 'age_25_34', 'age_35_44', 'age_45_59', 'age_60_up']
export const FOUND_US = { tiktok: 'TikTok', facebook: 'Facebook', friends_family: 'Friends or family', google: 'Google', other: 'Other' }
export const REFUND_METHODS = { gcash: 'GCash', cash: 'Cash', bank: 'Bank transfer' }
export const CHANNELS = { online: 'Online', walk_in: 'Walk-in', messenger: 'Messenger', phone: 'Phone' }
export const REASONS = {
  weather: 'Bad weather',
  health_emergency: 'Health emergency',
  death: 'Death in the family',
  guest_request: 'Guest request (personal reason)',
  other: 'Other',
}

// A booking row from the database, plus the friendly fields the pages read.
function shape(b, acts) {
  return {
    ...b,
    activity: acts ? acts[b.activity_id] || null : b.activity,
    channel: b.source,
    organizer: b.is_organizer,
    found_via: FOUND_US[b.found_us] || null,
    emergency_name: b.emergency_contact_name,
    emergency_contact: b.emergency_contact_number,
    age_counts: Object.fromEntries(AGE_GROUPS.map((g, i) => [g, b[AGE_COLS[i]] || 0])),
    sex_counts: { male: b.male_count || 0, female: b.female_count || 0 },
    tents4: b.tents_for_4 || 0,
    tents2: b.tents_for_2 || 0,
  }
}

// ---------- activities ----------

export async function getActivities({ includeHidden = false } = {}) {
  let q = supabase.from('activities').select('*').order('code')
  if (!includeHidden) q = q.eq('is_active', true)
  return must(await q)
}
async function activityMap() {
  return Object.fromEntries((await getActivities({ includeHidden: true })).map((a) => [a.id, a]))
}

// Staff names. A Super Admin can see everyone; others only see themselves (names show as "Staff").
async function staffNames() {
  const { data } = await supabase.from('admin_accounts').select('id, name')
  return Object.fromEntries((data || []).map((s) => [s.id, s.name]))
}
const nameOf = (names, id) => (id ? names[id] || 'Staff' : '—')

// Photo picked in Areas & prices (a shrunk JPEG as a data URL) -> uploaded to the public bucket.
async function uploadActivityPhoto(code, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${code}-${Date.now()}.jpg`
  must(await supabase.storage.from('activity-photos').upload(path, blob, { contentType: 'image/jpeg' }))
  return supabase.storage.from('activity-photos').getPublicUrl(path).data.publicUrl
}
async function withPhoto(code, fields) {
  if (typeof fields.image_url === 'string' && fields.image_url.startsWith('data:')) {
    return { ...fields, image_url: await uploadActivityPhoto(code, fields.image_url) }
  }
  return fields
}

export async function updateActivity(admin, id, fields) {
  const [a] = must(await supabase.from('activities').select('code').eq('id', id))
  must(await supabase.from('activities').update(await withPhoto(a?.code || 'area', fields)).eq('id', id))
}

export async function createActivity(admin, f) {
  const code = f.code.trim().toUpperCase()
  if (!code || !f.name.trim()) throw new Error('Enter a code and a name.')
  if (f.price === '' || !(Number(f.price) >= 0)) throw new Error('Enter the price.')
  const camping = f.type === 'camping'
  const row = await withPhoto(code, {
    code, name: f.name.trim(), type: f.type,
    area_group: camping ? f.category?.trim() || null : null,
    category: camping ? f.category?.trim() || null : null,
    image_url: f.image_url || null,
    description: f.description.trim() || null, price: Number(f.price), price_unit: camping ? 'per_night' : 'per_person',
    per_person_price: camping ? Number(f.per_person_price || 0) : 0,
    viewing_price: camping || f.viewing_price === '' ? null : Number(f.viewing_price),
    min_age: camping || f.min_age === '' ? null : Number(f.min_age),
    daily_capacity: camping || f.daily_capacity === '' ? null : Number(f.daily_capacity),
  })
  must(await supabase.from('activities').insert(row))
}

// ---------- bookings ----------

// Last night of a camping stay (or the visit date for rock).
export function lastDay(b) {
  return b.nights ? addDays(b.visit_date, b.nights - 1) : b.visit_date
}

export async function listBookings(admin, { from, to, status, type, search } = {}) {
  let q = supabase.from('bookings').select('*').order('visit_date').order('created_at')
  if (from) q = q.gte('visit_date', addDays(from, -14)) // camping stays (max 14 nights) can start before `from`
  if (to) q = q.lte('visit_date', to)
  let rows = must(await q)
  if (from) rows = rows.filter((b) => lastDay(b) >= from)
  if (status) rows = rows.filter((b) => b.payment_status === status || b.attendance_status === status)
  const acts = await activityMap()
  rows = rows.map((b) => shape(b, acts))
  if (type) rows = rows.filter((b) => (type === 'camping') === isCamping(b.activity || {}))
  if (search) {
    const s = search.trim().toLowerCase()
    rows = rows.filter((b) => [b.reference_number, b.guest_name, b.email, b.contact_number, b.activity?.code].some((v) => String(v || '').toLowerCase().includes(s)))
  }
  return rows
}

export async function getBooking(admin, id) {
  const b = must(await supabase.from('bookings').select('*').eq('id', id).maybeSingle())
  if (!b) return null
  const [acts, names, payments, cancellations] = await Promise.all([
    activityMap(),
    staffNames(),
    supabase.from('payments').select('*').eq('booking_id', id).order('created_at').then(must),
    supabase.from('cancellations').select('*').eq('booking_id', id).order('created_at').then(must),
  ])
  return {
    ...shape(b, acts),
    created_by_name: b.created_by ? nameOf(names, b.created_by) : null,
    id_photos: await listIdPhotos(b.reference_number),
    payments: payments.map((p) => ({ ...p, recorded_by_name: p.recorded_by ? nameOf(names, p.recorded_by) : 'Guest (online)' })),
    cancellations: cancellations.map((c) => ({ ...c, processed_by_name: nameOf(names, c.processed_by) })),
  }
}

// ---------- ID photos (private bucket; Super Admin and Staff Admin only) ----------

export async function listIdPhotos(reference) {
  const { data, error } = await supabase.storage.from('id-photos').list(reference)
  if (error || !data?.length) return []
  const paths = data.filter((f) => f.name && !f.name.startsWith('.')).map((f) => `${reference}/${f.name}`)
  if (!paths.length) return []
  const { data: signed } = await supabase.storage.from('id-photos').createSignedUrls(paths, 600)
  return (signed || []).map((s, i) => ({ path: paths[i], name: paths[i].split('/')[1], url: s.signedUrl }))
}

// After the discount IDs are checked, the photos are deleted (Data Privacy Act).
export async function deleteIdPhotos(admin, paths) {
  must(await supabase.storage.from('id-photos').remove(paths))
}

// ---------- payments ----------

// amount_paid and payment_status follow the confirmed payments.
// (A database trigger will do this in January, C3. Until then the admin site does it.)
async function syncPaid(bookingId) {
  const b = must(await supabase.from('bookings').select('total_amount, amount_due, payment_status').eq('id', bookingId).single())
  const pays = must(await supabase.from('payments').select('amount').eq('booking_id', bookingId).eq('status', 'confirmed'))
  const paid = Math.round(pays.reduce((t, p) => t + Number(p.amount), 0) * 100) / 100
  let status = b.payment_status
  if (!['refunded', 'expired'].includes(status)) {
    if (paid >= Number(b.total_amount) - 0.005) status = 'paid'
    else if (paid >= Number(b.amount_due) - 0.005) status = 'down_payment'
    else status = 'pending'
  }
  must(await supabase.from('bookings').update({ amount_paid: paid, payment_status: status }).eq('id', bookingId))
}

async function addPayment(admin, bookingId, { amount, purpose, method, transaction_reference }) {
  must(await supabase.from('payments').insert({
    booking_id: bookingId, amount: Math.round(amount * 100) / 100, purpose, method, status: 'confirmed',
    transaction_reference: transaction_reference || null, recorded_by: admin.id, paid_at: new Date().toISOString(),
  }))
}

export async function recordPayment(admin, bookingId, fields) {
  if (!(fields.amount > 0)) throw new Error('Enter an amount greater than zero.')
  await addPayment(admin, bookingId, fields)
  await syncPaid(bookingId)
}

// Online bookings still waiting for their GCash down payment.
export async function listAwaitingPayment(admin) {
  const acts = await activityMap()
  const rows = must(await supabase.from('bookings').select('*').eq('payment_status', 'pending').neq('attendance_status', 'cancelled').order('hold_expires_at'))
  const now = Date.now()
  return rows.map((b) => ({ ...shape(b, acts), hold_ended: b.hold_expires_at ? new Date(b.hold_expires_at).getTime() < now : false }))
}

// Frees the spot of an unpaid booking whose hold ended (an automatic job comes later).
export async function releaseUnpaid(admin, bookingId) {
  must(await supabase.from('bookings').update({ payment_status: 'expired' }).eq('id', bookingId))
}

// ---------- attendance ----------

// Done / Failed to show goes through mark_attendance (Field Staff may only do this).
// Undo (back to Upcoming) is a normal update, which only Super Admin and Staff Admin may do.
export async function setAttendance(admin, bookingId, attendance) {
  if (attendance === 'upcoming') {
    must(await supabase.from('bookings').update({ attendance_status: 'upcoming' }).eq('id', bookingId))
  } else {
    must(await supabase.rpc('mark_attendance', { p_booking_id: bookingId, p_status: attendance }))
  }
}

// ---------- daily rock limit ----------

// Same count the database uses (check_booking_availability): viewers count, cancelled and
// expired don't, and an unpaid online booking counts only while its 15-minute hold lasts.
export async function capacityFor(admin, activity, date) {
  const ov = must(await supabase.from('date_overrides').select('is_closed, daily_capacity').eq('activity_id', activity.id).eq('override_date', date).maybeSingle())
  if (ov?.is_closed) return { closed: true, cap: 0, booked: 0 }
  const cap = ov?.daily_capacity ?? activity.daily_capacity ?? 80
  const rows = must(await supabase.from('bookings').select('group_size, payment_status, hold_expires_at')
    .eq('activity_id', activity.id).eq('visit_date', date).in('attendance_status', ['upcoming', 'done'])
    .in('payment_status', ['pending', 'down_payment', 'paid']))
  const now = Date.now()
  const booked = rows.filter((b) => b.payment_status !== 'pending' || !b.hold_expires_at || new Date(b.hold_expires_at).getTime() > now)
    .reduce((t, b) => t + b.group_size, 0)
  return { closed: false, cap, booked }
}

// ---------- staff-entered bookings (walk-in, Messenger, phone) ----------

function walkInRow(activity, { visit_date, nights, form, capacity_override, consent_given_at }) {
  const camping = isCamping(activity)
  const rock = isRock(activity)
  const price = previewPrice(activity, { ...form, nights: nights || 1 })
  return {
    activity_id: activity.id, visit_date, nights: camping ? nights : null,
    guest_name: form.name.trim(), companions_names: [], contact_number: form.contact.replace(/[\s-]/g, ''),
    email: form.email.trim() || 'walk-in@goatcliff.ph',
    group_size: form.groupSize, viewing_count: rock ? form.viewers : 0,
    senior_count: form.organizer ? 0 : form.seniors, pwd_count: form.organizer ? 0 : form.pwd,
    child_count: form.organizer ? 0 : form.children, local_count: form.organizer ? 0 : form.locals,
    is_organizer: !!form.organizer,
    province: form.province?.trim() || null,
    found_us: form.foundUs || null,
    emergency_contact_name: rock ? form.emergencyName.trim() : null,
    emergency_contact_number: rock ? form.emergencyContact.replace(/[\s-]/g, '') : null,
    ...Object.fromEntries(AGE_GROUPS.map((g, i) => [AGE_COLS[i], form.ages[g] || 0])),
    male_count: form.sexes.male, female_count: form.sexes.female,
    tents_for_4: camping ? form.tents4 || 0 : 0, tents_for_2: camping ? form.tents2 || 0 : 0,
    total_amount: price.total, amount_due: price.downPayment, amount_paid: 0,
    payment_status: 'pending', attendance_status: 'upcoming',
    source: form.channel || 'walk_in', capacity_override: !!capacity_override, hold_expires_at: null,
    consent_given_at, // created_by is filled in by the database
  }
}

export async function createWalkIn(admin, { activity, visit_date, nights, form, paidNow, method, capacity_override, consent_given_at }) {
  if (!consent_given_at) throw new Error('Tick that the guest agreed to the Privacy Notice, Booking Terms and waiver.')
  const row = walkInRow(activity, { visit_date, nights, form, capacity_override, consent_given_at })
  const b = must(await supabase.from('bookings').insert(row).select().single())
  // Money received at the counter: first counts as the down payment, anything above it as balance.
  if (paidNow > 0) {
    const down = Math.min(paidNow, row.amount_due)
    if (down > 0) await addPayment(admin, b.id, { amount: down, purpose: 'down_payment', method })
    if (paidNow > down) await addPayment(admin, b.id, { amount: paidNow - down, purpose: 'balance', method })
    await syncPaid(b.id)
  }
  return b
}

// ---------- reschedules, refunds, cancellations ----------

export async function processCancellation(admin, bookingId, { action, reason_category, reason_details, new_visit_date, refund_amount, refund_method }) {
  const b = must(await supabase.from('bookings').select('visit_date').eq('id', bookingId).single())
  // FR-26: until Dec 31 of the visit's year, at least 2 days before the visit.
  const today = todayManila()
  const yearEnd = b.visit_date.slice(0, 4) + '-12-31'
  if (b.visit_date >= today && b.visit_date < addDays(today, 2)) throw new Error('Changes must be made at least 2 days before the visit.')
  if (today > yearEnd) throw new Error(`Changes for ${b.visit_date.slice(0, 4)} visits closed on Dec 31.`)
  if (!reason_category) throw new Error('Choose a reason.')
  if (action === 'reschedule') {
    if (!new_visit_date) throw new Error('Pick the new date.')
    if (new_visit_date > yearEnd) throw new Error(`The new date must be on or before Dec 31, ${b.visit_date.slice(0, 4)}.`)
    if (new_visit_date < addDays(today, 2)) throw new Error('The new date must be at least 2 days from today.')
  }
  if (action === 'refund' && !(refund_amount > 0)) throw new Error('Enter the refund amount.')

  // Move or cancel the booking first, so a full or closed new date stops everything.
  if (action === 'reschedule') must(await supabase.from('bookings').update({ visit_date: new_visit_date, attendance_status: 'upcoming' }).eq('id', bookingId))
  else must(await supabase.from('bookings').update({ attendance_status: 'cancelled', ...(action === 'refund' ? { payment_status: 'refunded' } : {}) }).eq('id', bookingId))

  must(await supabase.from('cancellations').insert({
    booking_id: bookingId, action, reason_category, reason_details: reason_details?.trim() || null,
    original_visit_date: b.visit_date, new_visit_date: action === 'reschedule' ? new_visit_date : null,
    refund_amount: action === 'refund' ? refund_amount : null,
    refund_method: action === 'refund' ? refund_method || null : null,
    refund_status: action === 'refund' ? 'pending' : 'not_applicable',
    processed_by: admin.id,
  }))
}

export async function listCancellations(admin) {
  const [rows, acts, names] = await Promise.all([
    supabase.from('cancellations').select('*, booking:bookings(id, guest_name, reference_number, activity_id)').order('created_at', { ascending: false }).then(must),
    activityMap(),
    staffNames(),
  ])
  return rows.map((c) => ({ ...c, booking: c.booking || {}, activity: acts[c.booking?.activity_id], processed_by_name: nameOf(names, c.processed_by) }))
}

export async function markRefundProcessed(admin, cancellationId) {
  must(await supabase.from('cancellations').update({ refund_status: 'processed' }).eq('id', cancellationId))
}

export async function markGuestNotified(admin, cancellationId) {
  must(await supabase.from('cancellations').update({ guest_notified_at: new Date().toISOString() }).eq('id', cancellationId))
}

// ---------- closed days and changed limits ----------

export async function listOverrides(admin) {
  const [rows, acts, names] = await Promise.all([
    supabase.from('date_overrides').select('*').gte('override_date', addDays(todayManila(), -30)).order('override_date').then(must),
    getActivities({ includeHidden: true }),
    staffNames(),
  ])
  const byId = Object.fromEntries(acts.map((a) => [a.id, a]))
  const activeIds = acts.filter((a) => a.is_active).map((a) => a.id)
  // Rows saved together with "All activities" (same date, same setting, every active activity) show as one entry.
  const groups = {}
  for (const o of rows) (groups[[o.override_date, o.is_closed, o.daily_capacity, o.reason].join('|')] ||= []).push(o)
  const out = []
  for (const list of Object.values(groups)) {
    const all = activeIds.length > 1 && activeIds.every((id) => list.some((o) => o.activity_id === id))
    if (all) out.push({ ...list[0], activity: null, all: true, set_by_name: nameOf(names, list[0].set_by) })
    else for (const o of list) out.push({ ...o, activity: byId[o.activity_id] || null, set_by_name: nameOf(names, o.set_by) })
  }
  return out.sort((a, b) => a.override_date.localeCompare(b.override_date))
}

// activity_id 'ALL' closes every activity that day (one row per activity).
export async function saveOverride(admin, { activity_id, override_date, is_closed, daily_capacity, reason }) {
  if (!override_date) throw new Error('Pick a date.')
  if (!reason?.trim()) throw new Error('Write a reason (only admins see it).')
  if (!is_closed && !(daily_capacity >= 0)) throw new Error('Enter the new daily limit.')
  const ids = activity_id === 'ALL' ? (await getActivities()).map((a) => a.id) : [activity_id]
  // One row per activity and date: change it if it exists (no deleting), otherwise add it.
  must(await supabase.from('date_overrides').upsert(ids.map((id) => ({
    activity_id: id, override_date, is_closed, daily_capacity: is_closed ? null : daily_capacity, reason: reason.trim(), set_by: admin.id,
  })), { onConflict: 'activity_id,override_date' }))
  // Bookings already on that date, so the admin can reschedule or refund each one.
  return (await listBookings(admin, { from: override_date, to: override_date }))
    .filter((b) => (activity_id === 'ALL' || b.activity_id === activity_id) && b.attendance_status === 'upcoming'
      && !['expired', 'refunded'].includes(b.payment_status))
}

// ---------- staff accounts (Super Admin) ----------

export async function listStaff(admin) {
  const rows = must(await supabase.from('admin_accounts').select('id, name, role, is_active, created_at'))
  return rows.sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name))
}

// The login is made by the create-staff Edge Function (it holds the secret key, never this site).
export async function createStaff(admin, { name, email, password, role }) {
  if (!name.trim()) throw new Error('Enter the staff member\'s name.')
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter a valid email. They sign in with it.')
  const { data, error } = await supabase.functions.invoke('create-staff', { body: { name: name.trim(), email: email.trim(), password, role } })
  if (error) {
    // The function's own message (e.g. email already used, weak password) is in the response body.
    let message = ''
    try { message = (await error.context?.json())?.error || '' } catch { /* not JSON */ }
    throw new Error(message ? (message.endsWith('.') ? message : message + '.') : 'Could not add this staff member.')
  }
  return data
}

export async function updateStaff(admin, id, fields) {
  if (id === admin.id && (fields.is_active === false || (fields.role && fields.role !== admin.role))) {
    throw new Error('Ask another Super Admin to change your own account.')
  }
  must(await supabase.from('admin_accounts').update(fields).eq('id', id))
}

// ---------- Field Staff ----------
// Every Field Staff sees all groups (guides rotate by station). Only safe columns: no money.
export async function listMyGroups() {
  const acts = await activityMap()
  const rows = must(await supabase.from('bookings')
    .select('id, reference_number, visit_date, nights, activity_id, guest_name, contact_number, group_size, viewing_count, senior_count, pwd_count, child_count, attendance_status, payment_status, emergency_contact_name, emergency_contact_number')
    .gte('visit_date', addDays(todayManila(), -14)).lte('visit_date', addDays(todayManila(), 14))
    .neq('attendance_status', 'cancelled').neq('payment_status', 'expired').order('visit_date'))
  return rows.map((b) => ({ ...b, activity: acts[b.activity_id] || null }))
}

// ---------- Today page ----------

export async function dashboardSummary(admin) {
  const today = todayManila()
  const all = await listBookings(admin, { from: addDays(today, -1), to: addDays(today, 14) })
  const live = all.filter((b) => b.attendance_status !== 'cancelled' && b.payment_status !== 'expired')
  const todays = live.filter((b) => b.visit_date <= today && lastDay(b) >= today)
  const activities = await getActivities({ includeHidden: true })
  const rock = activities.find((a) => isRock(a) && a.is_active)
  return {
    today,
    todays,
    arrivingToday: todays.filter((b) => b.visit_date === today),
    peopleToday: todays.reduce((t, b) => t + b.group_size, 0),
    awaiting: live.filter((b) => b.payment_status === 'pending' && b.source === 'online').length,
    holdsEnded: live.filter((b) => b.payment_status === 'pending' && b.hold_expires_at && new Date(b.hold_expires_at) < new Date()).length,
    rockCap: rock ? await capacityFor(admin, rock, today) : null,
    upcoming: live.filter((b) => b.visit_date > today && b.visit_date <= addDays(today, 7)),
    // Rock headcount for the next 14 days (the elevation profile on the Today page)
    profile: rock ? await Promise.all(Array.from({ length: 14 }, async (_, i) => {
      const date = addDays(today, i)
      return { date, ...(await capacityFor(admin, rock, date)) }
    })) : [],
    // Which camping areas have someone staying tonight
    campingTonight: activities.filter((a) => isCamping(a) && a.is_active).map((a) => {
      const b = live.find((x) => x.activity_id === a.id && x.visit_date <= today && lastDay(x) >= today)
      return { area: a, booking: b || null, arriving: !!b && b.visit_date === today }
    }),
  }
}

// ---------- monthly report (FR-29) ----------
// Totals come from the report_monthly_* views; bookings per day is counted from the bookings table.

export async function analytics(admin, { month }) {
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const view = (name) => supabase.from(name).select('*').eq('month', from).then(must)
  const [byAct, guests, provinces, foundUs, income, rows] = await Promise.all([
    view('report_monthly_bookings'), view('report_monthly_guests'), view('report_monthly_provinces'),
    view('report_monthly_found_us'), view('report_monthly_income'),
    supabase.from('bookings').select('visit_date, attendance_status, payment_status').gte('visit_date', from).lte('visit_date', to).then(must),
  ])
  const counted = rows.filter((b) => b.attendance_status !== 'cancelled' && b.payment_status !== 'expired')
  const byDay = {}
  for (let d = from; d <= to; d = addDays(d, 1)) byDay[d] = 0
  for (const b of counted) byDay[b.visit_date] += 1
  const visited = counted.filter((b) => b.visit_date < todayManila() && b.attendance_status !== 'upcoming')
  const failed = visited.filter((b) => b.attendance_status === 'failed_to_show').length
  const g = guests[0] || {}
  const sum = (list, k) => list.reduce((t, r) => t + Number(r[k] || 0), 0)
  return {
    from, to,
    bookings: counted.length,
    people: sum(provinces, 'people'), // the provinces view leaves out cancelled bookings
    income: sum(income, 'income'),
    cancelled: sum(byAct, 'cancelled'),
    failedRate: visited.length ? Math.round((failed / visited.length) * 100) : null,
    failed, visited: visited.length,
    byDay: Object.entries(byDay),
    byActivity: byAct.map((r) => [r.activity || 'Unknown', Number(r.bookings) - Number(r.cancelled)]).sort((a, b) => b[1] - a[1]),
    bySex: [['Male', Number(g.male || 0)], ['Female', Number(g.female || 0)]],
    byAge: AGE_GROUPS.map((label, i) => [label, Number(g[AGE_COLS[i]] || 0)]),
    byProvince: provinces.map((r) => [r.province || 'Not given', Number(r.people)]).sort((a, b) => b[1] - a[1]),
    byFoundVia: foundUs.map((r) => [FOUND_US[r.found_us] || 'Not given', Number(r.bookings)]).sort((a, b) => b[1] - a[1]),
  }
}

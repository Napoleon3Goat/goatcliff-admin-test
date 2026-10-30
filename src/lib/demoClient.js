// DEMO MODE: a pretend Supabase used when no Supabase settings are given (for example on GitHub Pages).
// Nothing here talks to the real database. Data is made up for showing the design.
const camping = [
  ['LA1','Lower Area 1','Lower Area','30 ft x 29 ft',2000],['LA2','Lower Area 2','Lower Area','37 ft x 26 ft',2000],
  ['LA3','Lower Area 3','Lower Area','28 ft x 21 ft',1500],['LA4','Lower Area 4','Lower Area','Front 29 ft, back 21 ft, right 14 ft, left 21 ft',1000],
  ['UA1','Upper Area 1','Upper Area','16 ft x 14 ft',1500],['UA2','Upper Area 2','Upper Area','18 ft x 12 ft',1000],
  ['UA3','Upper Area 3','Upper Area','26 ft x 8 ft',500],['UA4','Upper Area 4','Upper Area','33 ft x 8 ft',500],
  ['UA5','Upper Area 5','Upper Area','43 ft x 14 ft',1500],['UT','Under the Tree','Under the Tree','13 ft x 12 ft',500],
  ['CA1','Car Camping Area 1','Car Camping Area','20 ft x 28 ft',2000],['CA2','Car Camping Area 2','Car Camping Area','20 ft x 28 ft',2000],
  ['CA3','Car Camping Area 3','Car Camping Area','20 ft x 28 ft',1500],['CA4','Car Camping Area 4','Car Camping Area','20 ft x 28 ft',1000],
].map(([code, name, area_group, description, price], i) => ({
  id: 'demo-' + i, code, name, type: 'camping', area_group, description, price, price_unit: 'per_night',
  per_person_price: 100, capacity: null, daily_capacity: null, viewing_price: null, min_age: null,
  advance_notice_days: 2,
  // UA1 and UA2 are no longer offered (Goatcliff interview, Oct 25)
  is_active: !['UA1', 'UA2'].includes(code),
}))
const rock = {
  id: 'demo-rock', code: 'ROCK', name: 'Rock Activities Package', type: 'rock_activity', area_group: null,
  description: 'Via Ferrata (unlimited rounds), Rappelling (3 rounds), Zipline, Burmese Bridge, and Tyrolean Traverse (unlimited rounds). Safety gear and guide assistance included. Weather dependent: please arrive early.',
  price: 1500, price_unit: 'per_person', per_person_price: 0, capacity: 50, daily_capacity: 80,
  viewing_price: 250, min_age: 10, advance_notice_days: 2, is_active: true,
}
// Viewing is its own activity since the Oct 25 interview (FR-05). It shares the rock's 80 people a day.
const viewing = {
  id: 'demo-view', code: 'VIEW', name: 'Viewing', type: 'viewing', area_group: null,
  description: 'Go up to the rock area to watch your group. All ages.',
  price: 250, price_unit: 'per_person', per_person_price: 0, capacity: 50, daily_capacity: 80,
  viewing_price: null, min_age: null, advance_notice_days: 2, is_active: true,
}
const tables = { activities: [rock, viewing, ...camping] }

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function query(table) {
  let rows = () => (tables[table] || []).slice()
  const filters = []
  let orderBy = null
  const q = {
    select() { return q },
    eq(col, val) { filters.push((r) => r[col] === val); return q },
    order(col) { orderBy = col; return q },
    async maybeSingle() { const { data } = await run(); return { data: data[0] ?? null, error: null } },
    then(res, rej) { return run().then(res, rej) },
  }
  async function run() {
    await wait(250)
    if (table === 'admin_accounts') {
      const s = session
      if (!s) return { data: [], error: null }
      return { data: [s.admin], error: null }
    }
    let data = rows().filter((r) => filters.every((f) => f(r)))
    if (orderBy) data.sort((a, b) => String(a[orderBy]).localeCompare(String(b[orderBy])))
    return { data, error: null }
  }
  return q
}

let session = null
try { session = JSON.parse(sessionStorage.getItem('demo-session')) } catch {}
const listeners = new Set()
function setSession(s) {
  session = s
  try { s ? sessionStorage.setItem('demo-session', JSON.stringify(s)) : sessionStorage.removeItem('demo-session') } catch {}
  listeners.forEach((fn) => fn(s ? 'SIGNED_IN' : 'SIGNED_OUT', s))
}

function roleFor(email) {
  if (/field/i.test(email)) return ['field_staff', 'Demo Field Staff']
  if (/staff/i.test(email)) return ['staff_admin', 'Demo Staff Admin']
  return ['super_admin', 'Demo Super Admin']
}

// Fake versions of the database functions the guest site calls.
function fakeBookedDates({ p_activity_id, p_from, p_to }) {
  const act = tables.activities.find((a) => a.id === p_activity_id)
  const rows = []
  for (let d = new Date(p_from + 'T00:00:00Z'); d <= new Date(p_to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    const day = d.getUTCDate()
    if (act?.type === 'camping') {
      if (day % 7 === 0) rows.push({ visit_date: iso, nights: 2, people: 4 })
    } else {
      if (day % 5 === 0) rows.push({ visit_date: iso, nights: null, people: 30 }, { visit_date: iso, nights: null, people: 22 })
      if (day % 9 === 0) rows.push({ visit_date: iso, nights: null, people: 70 })
      if (day === 20) rows.push({ visit_date: iso, nights: null, people: 80 })
    }
  }
  return rows
}
function fakeCalendarOverrides({ p_from, p_to }) {
  const rows = []
  for (let d = new Date(p_from + 'T00:00:00Z'); d <= new Date(p_to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDate() === 13) rows.push({ override_date: d.toISOString().slice(0, 10), is_closed: true, daily_capacity: null })
  }
  return rows
}

export function createClient() {
  return {
    from(table) {
      const q = query(table)
      // Guests may insert a booking but can't read it back (no .select() after insert).
      q.insert = async (row) => { await wait(500); return { data: null, error: null } }
      return q
    },
    async rpc(name, args) {
      await wait(250)
      if (name === 'booked_dates') return { data: fakeBookedDates(args), error: null }
      if (name === 'calendar_overrides') return { data: fakeCalendarOverrides(args), error: null }
      return { data: null, error: { message: 'function not found' } }
    },
    auth: {
      async getSession() { return { data: { session }, error: null } },
      onAuthStateChange(fn) { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } } },
      async signInWithPassword({ email }) {
        await wait(400)
        const [role, name] = roleFor(email)
        setSession({ user: { id: 'demo-user', email }, admin: { id: 'demo-admin', name, role, is_active: true } })
        return { data: { session }, error: null }
      },
      async signOut() { setSession(null); return { error: null } },
    },
  }
}

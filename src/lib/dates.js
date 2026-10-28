// All dates are plain 'YYYY-MM-DD' strings in Philippine time (Asia/Manila),
// so a guest browsing at 11 PM never sees "tomorrow" by mistake.

export function todayManila() {
  // 'en-CA' formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

// "Sat, Oct 10" (the year is shown only when it isn't this year: "Sat, Jan 9, 2027")
export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const thisYear = Number(todayManila().slice(0, 4))
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', ...(y !== thisYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  })
}

// Every date shown in a month grid, including blank spots before the 1st.
export function monthGrid(year, month) {
  // month is 0-11
  const first = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells = Array(first.getUTCDay()).fill(null) // blanks before the 1st (Sunday-first)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return cells
}

export function peso(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Whole pesos for big amounts: "₱6,000" (shows centavos only when there are some)
export function pesoShort(amount) {
  const n = Number(amount)
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
}

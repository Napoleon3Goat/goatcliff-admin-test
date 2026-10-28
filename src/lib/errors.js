// Turns raw database errors into messages an admin understands.
// The codes come from the backend (see "Errors to handle" in the handoff doc).
const MESSAGES = [
  ['no_double_booking_camping', 'This camping area is already booked on one of those nights. Pick other dates or another area.'],
  ['DAY_FULL', 'The rock is full that day. For a walk-in, tick "Accept beyond the cap" if it is safe to let them in.'],
  ['DATE_CLOSED', 'Goatcliff is closed on one of those dates.'],
  ['check constraint', 'Some of the numbers in your form don\'t add up. Please check the group size and discount counts.'],
]

export function friendlyError(error) {
  const text = error?.message || String(error || '')
  const match = MESSAGES.find(([code]) => text.includes(code))
  if (match) return match[1]
  if (text.toLowerCase().includes('fetch')) return 'Can\'t reach the server. Check your internet connection and try again.'
  // Messages written for people (they end with a period) are shown as they are.
  if (/^[A-Z].{3,200}\.$/.test(text)) return text
  return 'Something went wrong. Please try again.'
}

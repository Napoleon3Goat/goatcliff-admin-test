// PRICE PREVIEW ONLY.
// The official amount is always computed by the backend booking function.
// When the backend "quote" function exists, replace previewPrice() with a call to it
// so the formulas live in one place (the server).
//
// Rules (from the Goatcliff handoff doc):
//   Camping: area price x nights + per-person price x people x nights
//            minus 20% of (per-person price x nights) for each senior / PWD / child 7 and below / Atok local
//   Rock:    package price x participants + viewing price x viewers
//            participants = group size - viewers
//            6+ participants: 20% off the package part (assumption: viewing not discounted)
//            under 6: 20% off the package for each senior / PWD / Atok local participant (to confirm)
//   Down payment: 50% of the total, both activities.

export const DISCOUNT = 0.2
export const DOWN_PAYMENT = 0.5
export const GROUP_DISCOUNT_MIN = 6

export function isCamping(activity) {
  return activity.type === 'camping'
}

export function discountedCount(form) {
  return form.seniors + form.pwd + form.children + form.locals
}

export function previewPrice(activity, form) {
  const lines = []
  let total = 0

  if (isCamping(activity)) {
    const nights = form.nights
    const area = Number(activity.price) * nights
    const people = Number(activity.per_person_price) * form.groupSize * nights
    const discount = DISCOUNT * Number(activity.per_person_price) * nights * discountedCount(form)
    lines.push({ label: `Area ${activity.code} × ${nights} night${nights > 1 ? 's' : ''}`, amount: area })
    lines.push({ label: `${form.groupSize} ${form.groupSize > 1 ? 'people' : 'person'} × ${nights} night${nights > 1 ? 's' : ''}`, amount: people })
    if (discount > 0) lines.push({ label: `Discounts (${discountedCount(form)} ${discountedCount(form) > 1 ? 'people' : 'person'})`, amount: -discount })
    total = area + people - discount
  } else {
    const viewers = form.viewers
    const participants = form.groupSize - viewers
    const pkg = Number(activity.price) * participants
    const viewing = Number(activity.viewing_price) * viewers
    if (participants > 0) lines.push({ label: `Package × ${participants}`, amount: pkg })
    if (viewers > 0) lines.push({ label: `Viewing only × ${viewers}`, amount: viewing })

    let discount = 0
    if (participants >= GROUP_DISCOUNT_MIN) {
      discount = DISCOUNT * pkg
      lines.push({ label: 'Group discount (6 or more)', amount: -discount })
    } else {
      const eligible = Math.min(form.seniors + form.pwd + form.locals, participants)
      discount = DISCOUNT * Number(activity.price) * eligible
      if (discount > 0) lines.push({ label: `Discounts (${eligible} ${eligible > 1 ? 'people' : 'person'})`, amount: -discount })
    }
    total = pkg + viewing - discount
  }

  total = Math.round(total * 100) / 100
  return { lines, total, downPayment: Math.round(total * DOWN_PAYMENT * 100) / 100 }
}

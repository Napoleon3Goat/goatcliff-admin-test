// PRICE PREVIEW ONLY. The same file is in the guest site and the admin site.
// Later the backend will compute the official amount; then replace previewPrice() with that call.
//
// Rules (Goatcliff interview Oct 25 / Requirements Draft FR-20, FR-33):
//   One discount per person (20%). Discounts never stack.
//   Discounts come off BEFORE the 50% down payment.
//   Whole group 20%: organizers (staff-entered bookings), and rock / viewing groups of 6 or more (viewing too).
//   Otherwise per person 20%: seniors, PWDs, Atok locals; children 7 and below (viewing, and the camping per-person fee).
//   Camping: area price x nights + per-person price x people x nights.
//   Rock:    package price x participants + viewing price x viewers (participants = group - viewers).
//   Viewing: viewing price x people (its own activity; counts toward the rock's daily limit).
//   Tents (camping, per stay, not discounted): good for 4 = 350, good for 2 = 250.
//   Down payment: 50% of the discounted total.
//
// Assumptions to confirm with the group: the organizer 20% covers the whole booking (area price too);
// on a rock booking, senior / PWD / Atok local discounts go to package participants first.

export const DISCOUNT = 0.2
export const DOWN_PAYMENT = 0.5
export const GROUP_DISCOUNT_MIN = 6
export const TENTS = {
  tents4: { label: 'Tent, good for 4', price: 350, stock: 5 },
  tents2: { label: 'Tent, good for 2', price: 250, stock: 3 },
}

export function isCamping(activity) {
  return activity.type === 'camping'
}
export function isViewing(activity) {
  return activity.type === 'viewing'
}
export function isRock(activity) {
  return activity.type === 'rock_activity'
}

// People with a personal discount (one each)
export function discountedCount(form) {
  return form.seniors + form.pwd + (form.children || 0) + form.locals
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export function previewPrice(activity, form) {
  const lines = []
  let subtotal = 0
  let discount = 0
  let discountLabel = ''
  const group = form.groupSize
  const spl = form.seniors + form.pwd + form.locals
  const children = form.children || 0

  if (isCamping(activity)) {
    const nights = form.nights || 1
    const area = Number(activity.price) * nights
    const people = Number(activity.per_person_price) * group * nights
    lines.push({ label: `Area ${activity.code} × ${plural(nights, 'night', 'nights')}`, amount: area })
    lines.push({ label: `${plural(group, 'person', 'people')} × ${plural(nights, 'night', 'nights')}`, amount: people })
    subtotal = area + people
    if (form.organizer) {
      discount = DISCOUNT * subtotal
      discountLabel = 'Organizer discount (20%)'
    } else {
      const eligible = Math.min(spl + children, group)
      discount = DISCOUNT * Number(activity.per_person_price) * nights * eligible
      discountLabel = `Discounts (${plural(eligible, 'person', 'people')})`
    }
  } else if (isViewing(activity)) {
    subtotal = Number(activity.price) * group
    lines.push({ label: `Viewing × ${group}`, amount: subtotal })
    if (form.organizer || group >= GROUP_DISCOUNT_MIN) {
      discount = DISCOUNT * subtotal
      discountLabel = form.organizer ? 'Organizer discount (20%)' : 'Group of 6 or more (20%)'
    } else {
      const eligible = Math.min(spl + children, group)
      discount = DISCOUNT * Number(activity.price) * eligible
      discountLabel = `Discounts (${plural(eligible, 'person', 'people')})`
    }
  } else {
    const viewers = form.viewers || 0
    const participants = group - viewers
    const pkg = Number(activity.price) * participants
    const viewing = Number(activity.viewing_price || 0) * viewers
    if (participants > 0) lines.push({ label: `Package × ${participants}`, amount: pkg })
    if (viewers > 0) lines.push({ label: `Viewing only × ${viewers}`, amount: viewing })
    subtotal = pkg + viewing
    if (form.organizer || group >= GROUP_DISCOUNT_MIN) {
      discount = DISCOUNT * subtotal
      discountLabel = form.organizer ? 'Organizer discount (20%)' : 'Group of 6 or more (20%)'
    } else {
      const onPackage = Math.min(spl, participants)
      const onViewing = Math.min(children + Math.max(0, spl - participants), viewers)
      discount = DISCOUNT * (Number(activity.price) * onPackage + Number(activity.viewing_price || 0) * onViewing)
      discountLabel = `Discounts (${plural(onPackage + onViewing, 'person', 'people')})`
    }
  }

  discount = Math.round(discount * 100) / 100
  if (discount > 0) lines.push({ label: discountLabel, amount: -discount })

  let tents = 0
  if (isCamping(activity)) {
    for (const [key, t] of Object.entries(TENTS)) {
      const n = form[key] || 0
      if (n > 0) {
        lines.push({ label: `${t.label} × ${n}`, amount: t.price * n })
        tents += t.price * n
      }
    }
  }

  const total = Math.round((subtotal - discount + tents) * 100) / 100
  return { lines, total, downPayment: Math.round(total * DOWN_PAYMENT * 100) / 100 }
}

import logo from '../assets/logo-dark.png'
import { CHANNELS, FOUND_US } from '../lib/adminApi'
import { METHODS } from './ui'

// The printable monthly report (the approved format): Goat Cliff's logo and name,
// "Monthly Report", the month, who made it, then the sections the Super Admin ticked.
// It's only visible when printing ("Save as PDF"); see .report-print in index.css.
// data = monthlyReport(month); show = { money, bookings, guests } (true / false)
export default function MonthlyReport({ data, show, preparedBy }) {
  const monthName = new Date(data.month + '-01T00:00:00Z').toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const now = new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
  const { money, bookings, guests } = data
  const t = money.tally
  let section = 0 // numbers the sections that are included: 1, 2, 3

  return (
    <div className="report-print">
      <header className="rp-head">
        <img src={logo} alt="Goat Cliff logo" />
        <div className="rp-org">
          <b>Goat Cliff Rock Adventures and Camping</b>
          <span>Tagongtongao, Paoay, Atok, Benguet</span>
        </div>
        <div className="rp-title">
          <b>Monthly Report</b>
          {monthName}
        </div>
      </header>
      <div className="rp-meta">
        <span>For the month of {monthName}</span>
        <span>Generated: {now} by {preparedBy}</span>
      </div>

      {show.money && (
        <section>
          <h2>{++section}. Money and discounts</h2>
          <div className="rp-cards">
            <div><span>Income</span><b>{peso(money.income)}</b></div>
            <div><span>Refunds paid</span><b>{peso(money.refunded)}</b></div>
            <div><span>Net</span><b>{peso(money.net)}</b></div>
            <div><span>Discounts given</span><b>{peso(money.discountPesos)}</b></div>
          </div>
          <p className="rp-note">Income = confirmed payments received this month. Net = income minus refunds paid.</p>

          <div className="rp-two">
            <div>
              <h3>Income by payment method</h3>
              <table>
                <thead><tr><th>Method</th><th className="n">Payments</th><th className="n">Amount</th></tr></thead>
                <tbody>
                  {money.byMethod.map((r) => <tr key={r.key}><td>{METHODS[r.key] || r.key}</td><td className="n">{r.count}</td><td className="n">{peso(r.amount)}</td></tr>)}
                  {money.byMethod.length === 0 && <tr><td colSpan="3">No payments this month</td></tr>}
                  <tr className="total"><td>Total</td><td className="n">{sum(money.byMethod, 'count')}</td><td className="n">{peso(money.income)}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3>Income by activity</h3>
              <table>
                <thead><tr><th>Activity</th><th className="n">Amount</th></tr></thead>
                <tbody>
                  {money.byActivity.map((r) => <tr key={r.key}><td>{r.key}</td><td className="n">{peso(r.amount)}</td></tr>)}
                  <tr className="total"><td>Total</td><td className="n">{peso(money.income)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <h3>Discounts given</h3>
          <table>
            <thead><tr><th>Discount (20% each)</th><th className="n">People</th><th className="n">% of all guests</th></tr></thead>
            <tbody>
              <tr><td>Senior citizens</td><td className="n">{t.seniors}</td><td className="n">{pct(t.seniors, guests.total)}</td></tr>
              <tr><td>PWDs</td><td className="n">{t.pwds}</td><td className="n">{pct(t.pwds, guests.total)}</td></tr>
              <tr><td>Atok locals</td><td className="n">{t.locals}</td><td className="n">{pct(t.locals, guests.total)}</td></tr>
              <tr><td>Children 7 and below</td><td className="n">{t.children}</td><td className="n">{pct(t.children, guests.total)}</td></tr>
              <tr><td>Organizer groups ({t.organizerBookings} booking{t.organizerBookings === 1 ? '' : 's'})</td><td className="n">{t.organizer}</td><td className="n">{pct(t.organizer, guests.total)}</td></tr>
              <tr><td>Rock groups of 6 or more ({t.group6Bookings} booking{t.group6Bookings === 1 ? '' : 's'})</td><td className="n">{t.group6}</td><td className="n">{pct(t.group6, guests.total)}</td></tr>
              <tr className="total"><td>Total with a discount (out of {guests.total} guests)</td><td className="n">{discounted(t)}</td><td className="n">{pct(discounted(t), guests.total)}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      {show.bookings && (
        <section>
          <h2>{++section}. Bookings</h2>
          <div className="rp-cards">
            <div><span>Bookings</span><b>{bookings.total}</b></div>
            <div><span>Guests</span><b>{bookings.guests}</b></div>
            <div><span>Cancelled</span><b>{bookings.cancelled}</b></div>
            <div><span>Failed to show</span><b>{bookings.failed}</b></div>
          </div>
          <p className="rp-note">Bookings = every booking with a visit date this month, cancelled ones included. The guest counts and the tables below leave out cancelled bookings.</p>
          <div className="rp-two">
            <div>
              <h3>By activity</h3>
              <table>
                <thead><tr><th>Activity</th><th className="n">Bookings</th><th className="n">Guests</th></tr></thead>
                <tbody>
                  {bookings.byActivity.map((r) => <tr key={r.key}><td>{r.key}</td><td className="n">{r.count}</td><td className="n">{r.amount}</td></tr>)}
                  <tr className="total"><td>Total</td><td className="n">{sum(bookings.byActivity, 'count')}</td><td className="n">{bookings.guests}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3>How they booked</h3>
              <table>
                <thead><tr><th>Source</th><th className="n">Bookings</th><th className="n">%</th></tr></thead>
                <tbody>
                  {bookings.bySource.map((r) => <tr key={r.key}><td>{CHANNELS[r.key] || r.key}</td><td className="n">{r.count}</td><td className="n">{pct(r.count, sum(bookings.bySource, 'count'))}</td></tr>)}
                  <tr className="total"><td>Total</td><td className="n">{sum(bookings.bySource, 'count')}</td><td className="n">100%</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {show.guests && (
        <section className={show.money ? 'rp-new-page' : ''}>
          <h2>{++section}. Guests</h2>
          <div className="rp-two">
            <div>
              <h3>Where they came from</h3>
              <table>
                <thead><tr><th>Province / city</th><th className="n">Guests</th><th className="n">%</th></tr></thead>
                <tbody>
                  {topTen(guests.provinces).map((r) => <tr key={r.key}><td>{r.key}</td><td className="n">{r.amount}</td><td className="n">{pct(r.amount, guests.total)}</td></tr>)}
                  <tr className="total"><td>Total</td><td className="n">{guests.total}</td><td className="n">100%</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3>How they found Goat Cliff</h3>
              <table>
                <thead><tr><th>Answer</th><th className="n">Guests</th><th className="n">%</th></tr></thead>
                <tbody>
                  {guests.foundUs.map((r) => <tr key={r.key}><td>{FOUND_US[r.key] || 'Not given'}</td><td className="n">{r.amount}</td><td className="n">{pct(r.amount, guests.total)}</td></tr>)}
                  <tr className="total"><td>Total</td><td className="n">{guests.total}</td><td className="n">100%</td></tr>
                </tbody>
              </table>

              <h3>Male / female</h3>
              <table>
                <thead><tr><th></th><th className="n">Guests</th><th className="n">%</th></tr></thead>
                <tbody>
                  <tr><td>Male</td><td className="n">{guests.male}</td><td className="n">{pct(guests.male, guests.total)}</td></tr>
                  <tr><td>Female</td><td className="n">{guests.female}</td><td className="n">{pct(guests.female, guests.total)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <h3>Age groups</h3>
          <table>
            <thead><tr><th>Age</th>{guests.ages.map((a) => <th key={a.key} className="n">{a.key}</th>)}<th className="n">Total</th></tr></thead>
            <tbody>
              <tr><td>Guests</td>{guests.ages.map((a) => <td key={a.key} className="n">{a.amount}</td>)}<td className="n">{guests.total}</td></tr>
              <tr><td>%</td>{guests.ages.map((a) => <td key={a.key} className="n">{pct(a.amount, guests.total)}</td>)}<td className="n">100%</td></tr>
            </tbody>
          </table>
        </section>
      )}

      <footer className="rp-foot">
        <span>Goat Cliff Rock Adventures and Camping · Monthly Report · {monthName}</span>
        <span>Prepared by: {preparedBy}</span>
      </footer>
    </div>
  )
}

// ₱1,234.50
function peso(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 24 of 530 -> "4.5%"
function pct(part, whole) {
  if (!whole) return '0%'
  return (Math.round((part / whole) * 1000) / 10) + '%'
}

function sum(rows, key) {
  return rows.reduce((t, r) => t + r[key], 0)
}

// Everyone who got a discount (each person once)
function discounted(t) {
  return t.seniors + t.pwds + t.locals + t.children + t.organizer + t.group6
}

// The 9 biggest places, then "All others" for the rest
function topTen(rows) {
  if (rows.length <= 10) return rows
  const rest = rows.slice(9).reduce((total, r) => total + r.amount, 0)
  return [...rows.slice(0, 9), { key: 'All others', amount: rest }]
}

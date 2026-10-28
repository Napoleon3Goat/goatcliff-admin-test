import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getActivities, listOverrides, saveOverride, listBookings } from '../lib/adminApi'
import { formatDate, todayManila } from '../lib/dates'
import { isCamping } from '../lib/pricing'
import { friendlyError } from '../lib/errors'
import { Loading, ErrorState, Empty, PageHeader, Badge, PAYMENT, activityLabel, useLoad } from '../components/ui'

// Close a day (typhoon, repairs) or change the rock's daily cap for one date.
// Closing blocks NEW bookings only; existing ones are listed so each can be rescheduled or refunded.
export default function DateControls({ admin }) {
  const acts = useLoad(() => getActivities(), [])
  const list = useLoad(() => listOverrides(admin), [])
  const [activityId, setActivityId] = useState('')
  const [confirm, setConfirm] = useState(null) // closing a day asks first, showing what it affects
  const [date, setDate] = useState('')
  const [mode, setMode] = useState('close')
  const [cap, setCap] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [affected, setAffected] = useState(null)

  const activity = acts.data?.find((a) => a.id === activityId)
  const canChangeCap = activity && !isCamping(activity)

  const closing = mode === 'close' || !canChangeCap
  const scopeName = activityId === 'ALL' ? 'ALL activities' : activity ? activityLabel(activity) : ''

  async function ask(e) {
    e.preventDefault()
    if (!closing) return save()
    setError('')
    const rows = (await listBookings(admin, { from: date, to: date }))
      .filter((b) => (activityId === 'ALL' || b.activity_id === activityId) && b.attendance_status === 'upcoming')
    setConfirm({ count: rows.length })
  }

  async function save() {
    setConfirm(null)
    setError(''); setSaving(true); setAffected(null)
    try {
      const rows = await saveOverride(admin, {
        activity_id: activityId, override_date: date, is_closed: mode === 'close' || !canChangeCap,
        daily_capacity: Number(cap), reason,
      })
      setAffected({ date, rows, closed: mode === 'close' || !canChangeCap })
      setReason(''); setCap('')
      list.reload()
    } catch (err) { setError(friendlyError(err)) } finally { setSaving(false) }
  }

  const upcoming = (list.data || []).filter((o) => o.override_date >= todayManila())
  const rock = acts.data?.find((a) => !isCamping(a))

  return (
    <div>
      <PageHeader title="Calendar & closures" />
      <div className="grid-2 align-start">
        <form className="card form" onSubmit={ask}>
          <h2>Change a day</h2>
          {acts.error && <ErrorState message={acts.error} onRetry={acts.reload} />}
          <label>Activity
            <select id="dc-activity" value={activityId} onChange={(e) => { setActivityId(e.target.value); setConfirm(null) }} required>
              <option value="">Choose…</option>
              <option value="ALL">All activities (close everything)</option>
              {rock && <option value={rock.id}>{rock.name}</option>}
              {(acts.data || []).filter(isCamping).map((a) => <option key={a.id} value={a.id}>Camping {a.code}</option>)}
            </select>
          </label>
          <label>Date
            <input id="dc-date" type="date" min={todayManila()} value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          {canChangeCap && (
            <div className="segmented" role="group" aria-label="What to change">
              <button type="button" className={mode === 'close' ? 'on' : ''} onClick={() => setMode('close')}>Close the day</button>
              <button type="button" className={mode === 'cap' ? 'on' : ''} onClick={() => setMode('cap')}>Change the limit</button>
            </div>
          )}
          {canChangeCap && mode === 'cap' && (
            <label>New daily limit (people)
              <input id="dc-cap" type="number" min="0" value={cap} onChange={(e) => setCap(e.target.value)} placeholder={`Normally ${activity.daily_capacity ?? 80}`} required />
            </label>
          )}
          <label>Reason
            <input id="dc-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Typhoon signal no. 2" required />
          </label>
          {error && <p className="error">{error}</p>}
          {!confirm && (
            <button className={closing ? 'btn-danger' : 'btn-primary'} disabled={saving}>
              {saving ? 'Saving…' : closing ? 'Close this day…' : 'Save new limit'}
            </button>
          )}
          {confirm && (
            <div className="confirm" role="alertdialog" aria-label="Close this day?">
              <p><strong>Close {scopeName} on {formatDate(date)}?</strong>{' '}
                {confirm.count ? `${confirm.count} booking${confirm.count > 1 ? 's are' : ' is'} already on this date; you'll get the list to contact each guest.` : 'No bookings on this date yet.'}{' '}
                Announce it on Messenger and the Facebook page too.</p>
              <div className="actions-row">
                <button type="button" className="btn-quiet" onClick={() => setConfirm(null)}>Don't close</button>
                <button type="button" className="btn-danger" onClick={save} disabled={saving}>Yes, close it</button>
              </div>
            </div>
          )}
        </form>

        <div>
          {affected && (
            <section className="card notice-card">
              <h2>{affected.closed ? 'Day closed' : 'Cap changed'} · {formatDate(affected.date)}</h2>
              {affected.rows.length === 0 ? <p className="muted">No bookings on that date.</p> : (
                <>
                  <p className="muted">{affected.rows.length} booking{affected.rows.length > 1 ? 's' : ''} on this date</p>
                  <ul className="rows">
                    {affected.rows.map((b) => (
                      <li key={b.id}>
                        <Link to={`/bookings/${b.id}`} className="row-link">
                          <span className="row-main"><strong>{b.guest_name}</strong><span className="muted">{activityLabel(b.activity)} · {b.group_size} people</span></span>
                          <Badge map={PAYMENT} value={b.payment_status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          <section className="card">
            <h2>Upcoming changes</h2>
            {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
            {list.loading && <Loading />}
            {list.data && upcoming.length === 0 && <p className="muted">No closed days or cap changes coming up.</p>}
            {upcoming.length > 0 && (
              <ul className="rows">
                {upcoming.map((o) => (
                  <li key={o.id} className="row-static">
                    <span className="row-main">
                      <strong>{formatDate(o.override_date)} · {o.all ? 'All activities' : activityLabel(o.activity)}</strong>
                      <span className="muted">{o.is_closed ? 'Closed' : `Cap ${o.daily_capacity} people`} · {o.reason} · by {o.set_by_name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

// Small building blocks shared by every admin page.
import { useCallback, useEffect, useState } from 'react'
import { friendlyError } from '../lib/errors'

export function Loading({ text = 'Loading…' }) {
  return <div className="state">{text}</div>
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state" role="alert">
      <p className="error">{message}</p>
      {onRetry && <button className="btn-quiet" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function Empty({ text }) {
  return <div className="card empty">{text}</div>
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

// Plain-language names for the database's status values.
export const PAYMENT = {
  pending: ['Down payment not in yet', 'badge-wait'],
  down_payment: ['Half paid', 'badge-ok'],
  paid: ['Fully paid', 'badge-ok'],
  expired: ['Expired', 'badge-bad'],
  refunded: ['Refunded', 'badge-bad'],
}
export const ATTENDANCE = {
  upcoming: ['Upcoming', 'badge-info'],
  done: ['Done', 'badge-ok'],
  failed_to_show: ['Failed to show', 'badge-bad'],
  cancelled: ['Cancelled', 'badge-bad'],
}
export const PAYMENT_ROW = {
  pending: ['To verify', 'badge-wait'],
  confirmed: ['Confirmed', 'badge-ok'],
  failed: ['Rejected', 'badge-bad'],
  voided: ['Voided', 'badge-bad'],
}
export const METHODS = { gcash: 'GCash', cash: 'Cash', qrph: 'QR Ph', maya: 'Maya', card: 'Card', bank_transfer: 'Bank transfer' }

// Status as plain words, not coloured stickers. Colour is kept for meaning only:
// orange = someone needs to act, red = ended or failed, everything else stays ink.
const TONE = { 'badge-wait': 'st-act', 'badge-bad': 'st-bad', 'badge-ok': 'st-ok', 'badge-info': 'st-plain' }
export function Badge({ map, value }) {
  const [text, cls] = map[value] || [value, '']
  return <span className={'status ' + (TONE[cls] || 'st-plain')}>{text}</span>
}

// Loads data for a page and gives back { data, error, loading, reload }.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, error: '' })
  const load = useCallback(() => {
    let alive = true
    setState((s) => ({ ...s, error: '' }))
    fn().then((data) => alive && setState({ data, error: '' }))
      .catch((e) => alive && setState({ data: undefined, error: friendlyError(e) }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(load, [load])
  return { data: state.data, error: state.error, loading: state.data === undefined && !state.error, reload: load }
}

export function activityLabel(a) {
  if (!a) return '—'
  return a.type === 'camping' ? `Camping ${a.code}` : a.name
}

import { useState } from 'react'
import { listStaff, createStaff, updateStaff } from '../lib/adminApi'
import { ROLE_NAMES } from '../lib/menu'
import { friendlyError } from '../lib/errors'
import { Loading, ErrorState, PageHeader, useLoad } from '../components/ui'

const ROLE_HELP = {
  super_admin: 'Everything, including staff accounts, prices and analytics',
  staff_admin: 'Bookings, walk-ins, payments, cancellations and date controls',
  field_staff: "Today's groups only; marks Done or Failed to show. No payments.",
}

// Super Admin only. Staff are deactivated, never deleted, so old bookings keep their names.
export default function StaffAccounts({ admin }) {
  const { data, error, loading, reload } = useLoad(() => listStaff(admin), [])
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <PageHeader title="Staff">
        {!adding && <button className="btn-primary" onClick={() => setAdding(true)}>+ Add staff</button>}
      </PageHeader>

      {adding && <AddStaff admin={admin} onClose={() => { setAdding(false); reload() }} />}


      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && (
        <ul className="ledger panel">
          {data.map((s) => <StaffRow key={s.id} admin={admin} s={s} onDone={reload} />)}
        </ul>
      )}
    </div>
  )
}

function StaffRow({ admin, s, onDone }) {
  const [error, setError] = useState('')
  const [role, setRole] = useState(s.role)          // a changed role waits for "Save role"
  const [asking, setAsking] = useState(false)       // deactivating asks first
  const me = s.id === admin.id
  async function run(fields) {
    setError('')
    try { await updateStaff(admin, s.id, fields); setAsking(false); onDone() } catch (e) { setError(friendlyError(e)); setRole(s.role) }
  }
  return (
    <li className={s.is_active ? 'staff-row' : 'staff-row dim'}>
      <div className="ledger-row static">
        <span className="ledger-main">
          <strong>{s.name}{me && <span className="hint"> (you)</span>}</strong>
          <span className="muted break">{s.email}</span>
          {!s.is_active && <span className="status st-bad">Deactivated, can't sign in</span>}
        </span>
        <span className="staff-actions">
          <select id={`role-${s.id}`} value={role} disabled={me || !s.is_active} onChange={(e) => setRole(e.target.value)} aria-label={`Role for ${s.name}`}>
            {Object.entries(ROLE_NAMES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {!me && (s.is_active
            ? <button className="link-button danger" onClick={() => setAsking(true)}>Deactivate</button>
            : <button className="link-button" onClick={() => run({ is_active: true })}>Reactivate</button>)}
        </span>
      </div>
      {role !== s.role && (
        <div className="confirm">
          <p><strong>Make {s.name} a {ROLE_NAMES[role]}?</strong> {ROLE_HELP[role]}.</p>
          <div className="actions-row">
            <button className="btn-quiet" onClick={() => setRole(s.role)}>Cancel</button>
            <button className="btn-primary" onClick={() => run({ role })}>Save role</button>
          </div>
        </div>
      )}
      {asking && (
        <div className="confirm" role="alertdialog" aria-label={`Deactivate ${s.name}?`}>
          <p><strong>Deactivate {s.name}?</strong> They can't sign in anymore. Their name stays on old bookings, and you can reactivate them later.</p>
          <div className="actions-row">
            <button className="btn-quiet" onClick={() => setAsking(false)}>Keep active</button>
            <button className="btn-danger" onClick={() => run({ is_active: false })}>Yes, deactivate</button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </li>
  )
}

function AddStaff({ admin, onClose }) {
  const [f, setF] = useState({ name: '', email: '', role: 'staff_admin' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function save(e) {
    e.preventDefault()
    setError(''); setSaving(true)
    try { await createStaff(admin, f); onClose() } catch (err) { setError(friendlyError(err)); setSaving(false) }
  }
  return (
    <form className="card form" onSubmit={save}>
      <h2>Add staff</h2>
      <div className="form-grid">
        <label>Full name<input id="staff-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label>Email<input id="staff-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
        <label>Role
          <select id="staff-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {Object.entries(ROLE_NAMES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="actions-row">
        <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add staff'}</button>
      </div>
    </form>
  )
}

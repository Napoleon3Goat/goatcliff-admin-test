import { useState } from 'react'
import { getActivities, updateActivity, createActivity } from '../lib/adminApi'
import { peso } from '../lib/dates'
import { isCamping } from '../lib/pricing'
import { friendlyError } from '../lib/errors'
import { Loading, ErrorState, PageHeader, useLoad } from '../components/ui'

// Everything Goatcliff offers, read from the activities table (REAL data).
// The Super Admin can edit prices or hide an area; Staff Admin can only view.
export default function Activities({ admin }) {
  const { data, error, loading, reload } = useLoad(() => getActivities({ includeHidden: true }), [])
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const canEdit = admin.role === 'super_admin'

  const rock = (data || []).filter((a) => !isCamping(a))
  const groups = {}
  for (const a of (data || []).filter(isCamping)) (groups[a.area_group || 'Camping'] ||= []).push(a)

  return (
    <div>
      <PageHeader title="Areas & prices">
        {canEdit && !adding && <button className="btn-primary" onClick={() => setAdding(true)}>+ Add activity</button>}
      </PageHeader>
      {adding && <AddActivity admin={admin} onClose={() => { setAdding(false); reload() }} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}

      {rock.map((a) => (
        <section className="card" key={a.id}>
          <div className="row-between">
            <h2>{a.name}</h2>
            {canEdit && editing !== a.id && <button className="btn-quiet small" onClick={() => setEditing(a.id)}>Edit</button>}
          </div>
          {editing === a.id ? <EditForm admin={admin} a={a} onClose={() => { setEditing(null); reload() }} /> : (
            <dl className="facts">
              <dt>Package</dt><dd>{peso(a.price)} per person</dd>
              <dt>Viewing only</dt><dd>{a.viewing_price != null ? `${peso(a.viewing_price)} per person` : 'Not offered'}</dd>
              <dt>Minimum age</dt><dd>{a.min_age ?? 'None'}</dd>
              <dt>At once</dt><dd>{a.capacity ?? '—'} people (gear in use)</dd>
              <dt>Daily cap</dt><dd>{a.daily_capacity ?? 80} people</dd>
              <dt>Down payment</dt><dd>{a.down_payment_percent ?? 50}%</dd>
              <dt>Book ahead</dt><dd>{a.advance_notice_days} days</dd>
              <dt>Shown online</dt><dd>{a.is_active ? 'Yes' : 'Hidden'}</dd>
            </dl>
          )}
        </section>
      ))}

      {Object.entries(groups).sort(([a], [b]) => groupOrder(a) - groupOrder(b)).map(([group, areas]) => (
        <section className="card flush" key={group}>
          <h2 className="pad">{group}</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Area</th><th>Size</th><th className="num">Per night</th><th className="num">Per person / night</th><th>Online</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {areas.map((a) => editing === a.id ? (
                  <tr key={a.id}><td colSpan={canEdit ? 6 : 5}><EditForm admin={admin} a={a} onClose={() => { setEditing(null); reload() }} /></td></tr>
                ) : (
                  <tr key={a.id} className={a.is_active ? '' : 'dim'}>
                    <td><strong>{a.code}</strong></td>
                    <td>{a.description}</td>
                    <td className="num">{peso(a.price)}</td>
                    <td className="num">{peso(a.per_person_price)}</td>
                    <td>{a.is_active ? <span className="badge badge-ok">Shown</span> : <span className="badge badge-bad">Hidden</span>}</td>
                    {canEdit && <td><button className="link-button" onClick={() => setEditing(a.id)}>Edit</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

function AddActivity({ admin, onClose }) {
  const [f, setF] = useState({ type: 'camping', code: '', name: '', area_group: 'Lower Area', description: '', price: '', per_person_price: '100', viewing_price: '', min_age: '10', daily_capacity: '80' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const camping = f.type === 'camping'
  async function save(e) {
    e.preventDefault()
    setError(''); setSaving(true)
    try { await createActivity(admin, f); onClose() } catch (err) { setError(friendlyError(err)); setSaving(false) }
  }
  return (
    <form className="card form" onSubmit={save}>
      <h2>Add activity</h2>
      <div className="form-grid">
        <label>Kind
          <select id="new-type" value={f.type} onChange={set('type')}>
            <option value="camping">Camping area (price per night)</option>
            <option value="rock_activity">Rock activity (price per person)</option>
          </select>
        </label>
        <label>Code<input id="new-code" value={f.code} onChange={set('code')} placeholder={camping ? 'e.g. LA5' : 'e.g. ROCK2'} required /></label>
        <label>Name<input id="new-name" value={f.name} onChange={set('name')} placeholder={camping ? 'e.g. Lower Area 5' : 'e.g. Night Rappelling'} required /></label>
        {camping && (
          <label>Area
            <select id="new-area" value={f.area_group} onChange={set('area_group')}>
              {ORDER.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
        <label>{camping ? 'Price per night (₱)' : 'Price per person (₱)'}<input id="new-price" type="number" min="0" step="0.01" value={f.price} onChange={set('price')} required /></label>
        {camping
          ? <label>Per person per night (₱)<input id="new-pp" type="number" min="0" step="0.01" value={f.per_person_price} onChange={set('per_person_price')} /></label>
          : <>
              <label>Viewing only (₱)<input id="new-view" type="number" min="0" step="0.01" value={f.viewing_price} onChange={set('viewing_price')} placeholder="Leave empty if not offered" /></label>
              <label>Minimum age<input id="new-age" type="number" min="0" value={f.min_age} onChange={set('min_age')} /></label>
              <label>Daily cap (people)<input id="new-cap" type="number" min="1" value={f.daily_capacity} onChange={set('daily_capacity')} /></label>
            </>}
      </div>
      <label>{camping ? 'Size / description' : 'Description'}<textarea id="new-desc" rows={2} value={f.description} onChange={set('description')} /></label>
      {error && <p className="error">{error}</p>}
      <div className="actions-row">
        <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add activity'}</button>
      </div>
    </form>
  )
}

// Same order as the map: Lower Area, Upper Area, Under the Tree, Car Camping Area.
const ORDER = ['Lower Area', 'Upper Area', 'Under the Tree', 'Car Camping Area']
function groupOrder(name) {
  const i = ORDER.indexOf(name)
  return i === -1 ? ORDER.length : i
}

function EditForm({ admin, a, onClose }) {
  const camping = isCamping(a)
  const [f, setF] = useState({
    price: a.price, per_person_price: a.per_person_price, viewing_price: a.viewing_price ?? '', daily_capacity: a.daily_capacity ?? '',
    description: a.description || '', is_active: a.is_active,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function save(e) {
    e.preventDefault()
    setError('')
    const nums = ['price', 'per_person_price', 'viewing_price', 'daily_capacity'].filter((k) => f[k] !== '')
    if (nums.some((k) => Number(f[k]) < 0)) return setError('Prices and caps can\'t be negative.')
    setSaving(true)
    try {
      await updateActivity(admin, a.id, {
        price: Number(f.price), per_person_price: Number(f.per_person_price), description: f.description, is_active: f.is_active,
        ...(camping ? {} : { viewing_price: f.viewing_price === '' ? null : Number(f.viewing_price), daily_capacity: f.daily_capacity === '' ? null : Number(f.daily_capacity) }),
      })
      onClose()
    } catch (err) { setError(friendlyError(err)); setSaving(false) }
  }

  return (
    <form className="subform" onSubmit={save}>
      <div className="form-grid">
        <label>{camping ? 'Price per night (₱)' : 'Package price per person (₱)'}
          <input id={`act-price-${a.id}`} type="number" min="0" step="0.01" value={f.price} onChange={set('price')} required />
        </label>
        {camping ? (
          <label>Per person per night (₱)
            <input id={`act-pp-${a.id}`} type="number" min="0" step="0.01" value={f.per_person_price} onChange={set('per_person_price')} required />
          </label>
        ) : (
          <>
            <label>Viewing only (₱)
              <input id={`act-view-${a.id}`} type="number" min="0" step="0.01" value={f.viewing_price} onChange={set('viewing_price')} />
            </label>
            <label>Daily cap (people)
              <input id={`act-cap-${a.id}`} type="number" min="1" value={f.daily_capacity} onChange={set('daily_capacity')} />
            </label>
          </>
        )}
      </div>
      <label>{camping ? 'Size / description' : 'Description'}
        <textarea id={`act-desc-${a.id}`} rows={2} value={f.description} onChange={set('description')} />
      </label>
      <label className="check">
        <input id={`act-active-${a.id}`} type="checkbox" checked={f.is_active} onChange={set('is_active')} />
        <span>Show on the website for online booking</span>
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions-row">
        <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  )
}

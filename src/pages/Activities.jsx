import { useState } from 'react'
import { getActivities, updateActivity, createActivity } from '../lib/adminApi'
import { peso } from '../lib/dates'
import { isCamping, isViewing } from '../lib/pricing'
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
  for (const a of (data || []).filter(isCamping)) (groups[a.category || a.area_group || 'Camping'] ||= []).push(a)
  const categories = Object.keys(groups)

  return (
    <div>
      <PageHeader title="Areas & prices">
        {canEdit && !adding && <button className="btn-primary" onClick={() => setAdding(true)}>+ Add activity</button>}
      </PageHeader>
      {adding && <AddActivity admin={admin} categories={categories} onClose={() => { setAdding(false); reload() }} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}

      {rock.map((a) => (
        <section className="card" key={a.id}>
          <div className="row-between">
            <h2>{a.name}</h2>
            {canEdit && editing !== a.id && <button className="btn-quiet small" onClick={() => setEditing(a.id)}>Edit</button>}
          </div>
          {editing === a.id ? <EditForm admin={admin} a={a} categories={categories} onClose={() => { setEditing(null); reload() }} /> : isViewing(a) ? (
            <dl className="facts">
              <dt>Price</dt><dd>{peso(a.price)} per person, all ages</dd>
              <dt>Daily limit</dt><dd>Shared with the rock package</dd>
              <dt>Book ahead</dt><dd>{a.advance_notice_days} days</dd>
              <dt>Shown online</dt><dd>{a.is_active ? 'Yes' : 'Hidden'}</dd>
            </dl>
          ) : (
            <dl className="facts">
              <dt>Package</dt><dd>{peso(a.price)} per person</dd>
              <dt>Viewing only</dt><dd>{a.viewing_price != null ? `${peso(a.viewing_price)} per person` : 'Not offered'}</dd>
              <dt>Minimum age</dt><dd>{a.min_age ?? 'None'}</dd>
              <dt>At once</dt><dd>{a.capacity ?? '—'} people (gear in use)</dd>
              <dt>Daily limit</dt><dd>{a.daily_capacity ?? 80} people, viewers included</dd>
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
              <thead><tr><th>Area</th><th>Photo</th><th>Size</th><th className="num">Per night</th><th className="num">Per person / night</th><th>Online</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {areas.map((a) => editing === a.id ? (
                  <tr key={a.id}><td colSpan={canEdit ? 7 : 6}><EditForm admin={admin} a={a} categories={categories} onClose={() => { setEditing(null); reload() }} /></td></tr>
                ) : (
                  <tr key={a.id} className={a.is_active ? '' : 'dim'}>
                    <td><strong>{a.code}</strong></td>
                    <td>{a.image_url ? <img className="thumb" src={a.image_url} alt={`Area ${a.code}`} /> : <span className="hint">None</span>}</td>
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

function AddActivity({ admin, categories, onClose }) {
  const [f, setF] = useState({ type: 'camping', code: '', name: '', area_group: 'Lower Area', category: '', image_url: null, description: '', price: '', per_person_price: '100', viewing_price: '', min_age: '10', daily_capacity: '80' })
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
          <label>Category
            <input id="new-category" list="category-list" value={f.category} onChange={set('category')} placeholder="e.g. Lower Area" required />
            <CategoryList categories={categories} />
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
      <PhotoInput id="new-photo" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} />
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

function EditForm({ admin, a, categories, onClose }) {
  const camping = isCamping(a)
  const viewing = isViewing(a)
  const [f, setF] = useState({
    price: a.price, per_person_price: a.per_person_price, viewing_price: a.viewing_price ?? '', daily_capacity: a.daily_capacity ?? '',
    description: a.description || '', is_active: a.is_active, category: a.category || a.area_group || '', image_url: a.image_url || null,
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
        image_url: f.image_url, ...(camping ? { category: f.category.trim() || null } : {}),
        ...(camping || viewing ? {} : { viewing_price: f.viewing_price === '' ? null : Number(f.viewing_price), daily_capacity: f.daily_capacity === '' ? null : Number(f.daily_capacity) }),
      })
      onClose()
    } catch (err) { setError(friendlyError(err)); setSaving(false) }
  }

  return (
    <form className="subform" onSubmit={save}>
      <div className="form-grid">
        <label>{camping ? 'Price per night (₱)' : viewing ? 'Price per person (₱)' : 'Package price per person (₱)'}
          <input id={`act-price-${a.id}`} type="number" min="0" step="0.01" value={f.price} onChange={set('price')} required />
        </label>
        {camping && (
          <label>Category
            <input id={`act-cat-${a.id}`} list="category-list" value={f.category} onChange={set('category')} />
            <CategoryList categories={categories} />
          </label>
        )}
        {camping ? (
          <label>Per person per night (₱)
            <input id={`act-pp-${a.id}`} type="number" min="0" step="0.01" value={f.per_person_price} onChange={set('per_person_price')} required />
          </label>
        ) : viewing ? null : (
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
      <PhotoInput id={`act-photo-${a.id}`} value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} />
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

function CategoryList({ categories }) {
  const all = [...new Set([...ORDER, ...categories])]
  return <datalist id="category-list">{all.map((c) => <option key={c} value={c} />)}</datalist>
}

// Photo shown on the guest site (FR-07). Demo: the picture is shrunk and kept in this browser.
// Later it is uploaded to Supabase Storage and image_url holds its link.
function PhotoInput({ id, value, onChange }) {
  const [error, setError] = useState('')
  function pick(e) {
    const file = e.target.files?.[0]
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Choose a photo (JPG or PNG).')
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 900 / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      onChange(canvas.toDataURL('image/jpeg', 0.75))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => setError('That photo could not be opened.')
    img.src = URL.createObjectURL(file)
  }
  return (
    <div className="photo-input">
      {value && <img className="thumb large" src={value} alt="" />}
      <label>Photo <span className="hint">(shown on the website)</span>
        <input id={id} type="file" accept="image/*" onChange={pick} />
      </label>
      {value && <button type="button" className="link-button" onClick={() => onChange(null)}>Remove photo</button>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

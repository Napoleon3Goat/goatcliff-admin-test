import { useState } from 'react'
import { listWallets, saveWallet } from '../lib/adminApi'
import { friendlyError } from '../lib/errors'
import { Loading, ErrorState, PageHeader, useLoad } from '../components/ui'

const MAX_QR = 5 * 1024 * 1024
const QR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Payment details (Super Admin only): Goat Cliff's GCash and Maya.
// Guests see these on the payment page: the QR to scan, the number and the account name.
// Turning one off hides it from guests (for example, if the Maya account isn't ready).
export default function PaymentDetails({ admin }) {
  const { data, error, loading, reload } = useLoad(() => listWallets(), [])

  return (
    <div>
      <PageHeader title="Payment details" subtitle="Where guests send the down payment. Guests see these on the payment page." />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <Loading />}
      {data && (
        <div className="wallet-list">
          {data.map((w) => <WalletForm key={w.id + w.updated_at} admin={admin} w={w} onSaved={reload} />)}
        </div>
      )}
    </div>
  )
}

function WalletForm({ admin, w, onSaved }) {
  const [accountName, setAccountName] = useState(w.account_name)
  const [accountNumber, setAccountNumber] = useState(w.account_number)
  const [isActive, setIsActive] = useState(w.is_active)
  const [qrFile, setQrFile] = useState(null)
  const [preview, setPreview] = useState(null) // the new QR before saving
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function pickQr(e) {
    const file = e.target.files[0] || null
    setError('')
    if (file && !QR_TYPES.includes(file.type)) return setError('The QR must be a JPG, PNG or WebP picture.')
    if (file && file.size > MAX_QR) return setError('The QR picture is bigger than 5 MB.')
    setQrFile(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await saveWallet(admin, w.id, { account_name: accountName, account_number: accountNumber, is_active: isActive, qrFile })
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  const shownQr = preview || w.qrUrl

  return (
    <form className="panel wallet-form" onSubmit={save}>
      <h2>{w.name}</h2>
      <div className="wallet-body">
        <div className="wallet-qr">
          {shownQr
            ? <img src={shownQr} alt={`${w.name} QR code`} />
            : <p className="muted">No QR yet</p>}
          <label className="btn-quiet small file-pick">
            {shownQr ? 'Change QR picture' : 'Upload QR picture'}
            <input type="file" accept={QR_TYPES.join(',')} onChange={pickQr} />
          </label>
          {preview && <span className="muted">New picture, not saved yet</span>}
        </div>

        <div className="form-grid">
          <label className="wide">Account name
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={80} />
          </label>
          <label>Number
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={20} inputMode="tel" placeholder="09XX XXX XXXX" />
          </label>
          <label className="check-line">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Show {w.name} to guests
          </label>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions-row">
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : `Save ${w.name}`}</button>
      </div>
    </form>
  )
}

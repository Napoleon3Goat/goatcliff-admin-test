import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo-dark.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Supabase checks the email + password. We never see or store the password ourselves.
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      // Same message for wrong email or wrong password, so attackers can't guess which emails exist.
      setError('Incorrect email or password.')
    }
    // On success we don't need to do anything: App.jsx hears the login and opens the dashboard.
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="login-head">
          <span className="brand"><img src={logo} alt="" className="brand-logo" /><span className="wordmark">Goatcliff</span></span>
          <h1>Admin sign in</h1>
        </div>

        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const successMessage = location.state?.message

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate('/')
    } catch (err) {
      const msg = err.message || 'Login failed'
      setError(
        msg === 'Failed to fetch'
          ? 'Cannot reach the server. Make sure the backend is running on port 8000.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-card-top">
          <span className="brand-mark">₹</span>
          <h1>NiftyWatch</h1>
          <p className="muted">Sign in to your account</p>
        </div>
        {successMessage && <div className="banner ok">{successMessage}</div>}
        {error && <div className="banner error">{error}</div>}
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  )
}

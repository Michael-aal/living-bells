import { useState } from 'react'
import { api } from './api'
import './DevPasswordSetup.css'

export default function DevPasswordSetup({ user, onCompleted, onLogout }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Your new password must be at least 8 characters.')
    if (password !== confirm) return setError('The passwords do not match.')
    setSaving(true)
    try {
      const result = await api.completeDevPasswordSetup({ newPassword: password })
      if (result.token) localStorage.setItem('living_bells_token', result.token)
      localStorage.setItem('living_bells_user', JSON.stringify(result.user))
      onCompleted(result.user)
    } catch (err) {
      setError(err.message || 'Could not complete developer setup.')
    } finally {
      setSaving(false)
    }
  }

  return <main className="dev-setup-shell">
    <section className="dev-setup-card">
      <div className="dev-setup-logo">L</div>
      <span className="dev-setup-eyebrow">Developer account</span>
      <h1>Secure your developer account</h1>
      <p className="dev-setup-copy">This is your first developer login. Create the permanent password you will use from now on.</p>
      <div className="dev-setup-identity"><strong>{user.email}</strong><span>The setup password will stop working after this step.</span></div>
      {error && <div className="dev-setup-error">{error}</div>}
      <form onSubmit={submit}>
        <label>New permanent password<input type="password" minLength="8" autoFocus autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <label>Confirm permanent password<input type="password" minLength="8" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
        <button className="dev-setup-primary" disabled={saving}>{saving ? 'Securing account…' : 'Set permanent password'}</button>
      </form>
      <button className="dev-setup-logout" type="button" onClick={onLogout}>Log out</button>
    </section>
  </main>
}

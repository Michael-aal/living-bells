import { useState } from 'react'
import { api } from './api'
import './auth.css'

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'STAFF', adminKey: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const email = form.email.trim().toLowerCase()

      if (mode === 'login') {
        const result = await api.login({ email, password: form.password })
        localStorage.setItem('living_bells_token', result.token)
        localStorage.setItem('living_bells_user', JSON.stringify(result.user))
        onAuthenticated(result.user)
        return
      }

      if (form.password !== form.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const result = await api.register({
        name: form.name.trim(),
        email,
        password: form.password,
        role: form.role,
        adminKey: form.role === 'ADMIN' ? form.adminKey : undefined,
      })

      // Registration is complete immediately. The API returns a signed token,
      // so the new user enters the correct dashboard without an email step.
      localStorage.setItem('living_bells_token', result.token)
      localStorage.setItem('living_bells_user', JSON.stringify(result.user))
      onAuthenticated(result.user)
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><span>L</span><div><b>Living Bells</b><small>Church operations</small></div></div>
      <span className="eyebrow">Secure workspace</span>
      <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
      <p className="auth-subtitle">
        {isLogin
          ? 'Sign in with the account registered for your church workspace.'
          : 'Register once, then sign in directly with your email and password.'}
      </p>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={submit}>
        {!isLogin && <label>Full name<input value={form.name} onChange={e => update('name', e.target.value)} autoComplete="name" required /></label>}
        <label>Email<input type="email" value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" minLength="8" value={form.password} onChange={e => update('password', e.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} required /></label>

        {!isLogin && <label>Confirm password<input type="password" minLength="8" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} autoComplete="new-password" required /></label>}

        {!isLogin && <label>Account type<select value={form.role} onChange={e => update('role', e.target.value)}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></label>}
        {!isLogin && form.role === 'ADMIN' && <label>Admin registration key<input type="password" value={form.adminKey} onChange={e => update('adminKey', e.target.value)} autoComplete="off" required /></label>}

        <button className="primary auth-submit" disabled={loading}>
          {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="auth-switch">
        {isLogin ? <>New to Living Bells? <button type="button" onClick={() => { setError(''); setMode('register') }}>Create an account</button></> : <>Already registered? <button type="button" onClick={() => { setError(''); setMode('login') }}>Sign in</button></>}
      </div>
    </section>
  </main>
}

import { useEffect, useState } from 'react'
import { api } from './api'
import './auth.css'

export default function Auth({ onAuthenticated }) {
  const params = new URLSearchParams(window.location.search)
  const verifyToken = params.get('verify')
  const resetToken = params.get('reset')
  const [mode, setMode] = useState(resetToken ? 'reset' : verifyToken ? 'verify' : 'login')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF', adminKey: '' })
  const [resetPassword, setResetPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(Boolean(verifyToken))
  const update = (key, value) => setForm(x => ({ ...x, [key]: value }))

  useEffect(() => {
    if (!verifyToken) return
    api.verifyEmail(verifyToken)
      .then(result => {
        setNotice(result.message)
        window.history.replaceState({}, '', window.location.pathname)
        setMode('login')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [verifyToken])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const result = await api.login(form)
        localStorage.setItem('living_bells_token', result.token)
        localStorage.setItem('living_bells_user', JSON.stringify(result.user))
        onAuthenticated(result.user)
      } else if (mode === 'register') {
        const result = await api.register(form)
        setNotice(result.message)
        setForm(x => ({ ...x, password: '', adminKey: '' }))
        setMode('login')
      } else if (mode === 'forgot') {
        const result = await api.forgotPassword(form.email)
        setNotice(result.message)
      } else if (mode === 'reset') {
        const result = await api.resetPassword(resetToken, resetPassword)
        setNotice(result.message)
        setResetPassword('')
        window.history.replaceState({}, '', window.location.pathname)
        setMode('login')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function resendVerification() {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const result = await api.resendVerification(form.email)
      setNotice(result.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your staff account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Verify your email'
  const subtitle = mode === 'login'
    ? 'Sign in to manage church activities, attendance and expenses.'
    : mode === 'register'
      ? 'Choose Staff or Admin for this church workspace.'
      : mode === 'forgot'
        ? 'Enter your email and we will send you a secure reset link.'
        : mode === 'reset'
          ? 'Your new password must be at least 8 characters.'
          : 'We are confirming your email address.'

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><span>L</span><div><b>Living Bells</b><small>Church operations</small></div></div>
      <span className="eyebrow">Staff workspace</span>
      <h1>{title}</h1>
      <p className="auth-subtitle">{subtitle}</p>
      {error && <div className="auth-error">{error}</div>}
      {notice && <div className="auth-notice">{notice}</div>}

      {mode === 'verify' && loading ? <div className="auth-loading">Verifying your email...</div> : <form onSubmit={submit}>
        {mode === 'register' && <label>Full name<input value={form.name} onChange={e => update('name', e.target.value)} required /></label>}
        {(mode === 'login' || mode === 'register' || mode === 'forgot') && <label>Email<input type="email" value={form.email} onChange={e => update('email', e.target.value)} required /></label>}
        {(mode === 'login' || mode === 'register') && <label>Password<input type="password" minLength="8" value={form.password} onChange={e => update('password', e.target.value)} required /></label>}
        {mode === 'reset' && <label>New password<input type="password" minLength="8" value={resetPassword} onChange={e => setResetPassword(e.target.value)} required /></label>}
        {mode === 'register' && <label>Account type<select value={form.role} onChange={e => update('role', e.target.value)}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></label>}
        {mode === 'register' && form.role === 'ADMIN' && <label>Admin registration key<input type="password" value={form.adminKey} onChange={e => update('adminKey', e.target.value)} required /></label>}
        {mode === 'login' && <button type="button" className="auth-link" onClick={() => { setError(''); setNotice(''); setMode('forgot') }}>Forgot password?</button>}
        {mode === 'login' && error.includes('verify') && <button type="button" className="auth-link" onClick={resendVerification}>Resend verification email</button>}
        {mode !== 'verify' && <button className="primary auth-submit" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Reset password'}</button>}
      </form>}

      {mode === 'login' && <div className="auth-switch">New staff member? <button onClick={() => { setError(''); setNotice(''); setMode('register') }}>Create an account</button></div>}
      {mode === 'register' && <div className="auth-switch">Already registered? <button onClick={() => { setError(''); setNotice(''); setMode('login') }}>Sign in</button></div>}
      {(mode === 'forgot' || mode === 'reset') && <div className="auth-switch"><button onClick={() => { setError(''); setNotice(''); setMode('login') }}>Back to sign in</button></div>}
    </section>
  </main>
}

import { useState } from 'react'
import { api } from './api'
import './auth.css'

export default function Auth({ onAuthenticated, onBack }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'STAFF', inviteCode: '', department: '' })
  const [recovery, setRecovery] = useState({ email: '', recoveryKey: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [invitation, setInvitation] = useState(null)
  const [checkingCode, setCheckingCode] = useState(false)

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))

  async function checkInvitation() {
    const code = form.inviteCode.trim().toUpperCase()
    if (!code) return
    setError('')
    setCheckingCode(true)
    try {
      const result = await api.staffInvitationPreview(code)
      setInvitation(result)
      setForm(current => ({ ...current, name: result.name, email: result.email, department: result.department }))
    } catch (err) {
      setInvitation(null)
      setError(err.message || 'Invalid staff code')
    } finally {
      setCheckingCode(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const email = form.email.trim().toLowerCase()

      if (mode === 'recovery') {
        const recoveryEmail = recovery.email.trim().toLowerCase()
        if (recovery.password !== recovery.confirmPassword) throw new Error('Passwords do not match')
        const result = await api.recoverDevPassword({ email: recoveryEmail, recoveryKey: recovery.recoveryKey, newPassword: recovery.password })
        if (result.token) localStorage.setItem('living_bells_token', result.token)
        localStorage.removeItem('living_bells_offline_session')
        localStorage.setItem('living_bells_user', JSON.stringify(result.user))
        onAuthenticated(result.user)
        return
      }

      if (mode === 'login') {
        const result = await api.login({ email, password: form.password })
        if (result.token) localStorage.setItem('living_bells_token', result.token)
        if (result.offline) localStorage.setItem('living_bells_offline_session', '1')
        else localStorage.removeItem('living_bells_offline_session')
        localStorage.setItem('living_bells_user', JSON.stringify(result.user))
        onAuthenticated(result.user)
        return
      }

      if (form.role === 'STAFF' && !invitation) {
        await checkInvitation()
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
        inviteCode: form.role === 'STAFF' ? form.inviteCode : undefined,
      })

      localStorage.setItem('living_bells_token', result.token)
      localStorage.removeItem('living_bells_offline_session')
      localStorage.setItem('living_bells_user', JSON.stringify(result.user))
      onAuthenticated(result.user)
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'
  const isRecovery = mode === 'recovery'
  const isStaffRegistration = !isLogin && !isRecovery && form.role === 'STAFF'

  return <main className="auth-shell">
    <section className="auth-card">
      {onBack && <button type="button" className="auth-back" onClick={onBack}>← Back to website</button>}
      <div className="auth-brand"><span>L</span><div><b>Living Bells</b><small>Church operations</small></div></div>
      <span className="eyebrow">Secure workspace</span>
      <h1>{isRecovery ? 'Recover developer access' : isLogin ? 'Welcome back' : 'Create your account'}</h1>
      <p className="auth-subtitle">
        {isRecovery
          ? 'Use the recovery key generated for your developer account. You can view it again from Developer Console → Security.'
          : isLogin
            ? 'Sign in with your email and password.'
            : 'Staff registration uses a code provided by your church admin.'}
      </p>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={submit}>
        {isRecovery && <>
          <label>Developer email<input type="email" value={recovery.email} onChange={e => setRecovery(current => ({ ...current, email: e.target.value }))} autoComplete="email" required /></label>
          <label>Recovery key<input type="text" value={recovery.recoveryKey} onChange={e => setRecovery(current => ({ ...current, recoveryKey: e.target.value.toUpperCase() }))} autoComplete="off" placeholder="LB-XXXXX-XXXXX-XXXXX-XXXXX" required /></label>
          <label>New password<input type="password" minLength="8" value={recovery.password} onChange={e => setRecovery(current => ({ ...current, password: e.target.value }))} autoComplete="new-password" required /></label>
          <label>Confirm new password<input type="password" minLength="8" value={recovery.confirmPassword} onChange={e => setRecovery(current => ({ ...current, confirmPassword: e.target.value }))} autoComplete="new-password" required /></label>
          <button className="primary auth-submit" disabled={loading}>{loading ? 'Recovering…' : 'Reset developer password'}</button>
        </>}
        {!isLogin && !isRecovery && <label>Account type<select value={form.role} onChange={e => { update('role', e.target.value); setInvitation(null); setError('') }}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></label>}

        {!isLogin && form.role === 'ADMIN' && <>
          <label>Full name<input value={form.name} onChange={e => update('name', e.target.value)} autoComplete="name" required /></label>
          <label>Email<input type="email" value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" required /></label>
        </>}

        {isStaffRegistration && !invitation && <>
          <label>Staff code<input value={form.inviteCode} onChange={e => { update('inviteCode', e.target.value.toUpperCase()); setInvitation(null) }} autoComplete="one-time-code" placeholder="Enter the code from your admin" required /></label>
          <button type="button" className="secondary wide" disabled={checkingCode || !form.inviteCode.trim()} onClick={checkInvitation}>{checkingCode ? 'Checking code…' : 'Continue'}</button>
        </>}

        {isStaffRegistration && invitation && <div className="invite-details">
          <span className="eyebrow">Staff details</span>
          <b>{invitation.name}</b>
          <span>{invitation.email}</span>
          <span>{invitation.department}</span>
          <button type="button" className="secondary small-button" onClick={() => { setInvitation(null); update('password', ''); update('confirmPassword', '') }}>Change code</button>
        </div>}


        {(!isRecovery && (isLogin || invitation || (!isLogin && form.role === 'ADMIN'))) && <>
          {isLogin && <label>Email<input type="email" value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" required /></label>}
          <label>Password<input type="password" minLength="8" value={form.password} onChange={e => update('password', e.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} required /></label>
          {!isLogin && <label>Confirm password<input type="password" minLength="8" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} autoComplete="new-password" required /></label>}
        </>}

        {(!isLogin && !isRecovery && form.role === 'ADMIN') && <button className="primary auth-submit" disabled={loading}>{loading ? 'Please wait...' : 'Create account'}</button>}
        {isLogin && <button className="primary auth-submit" disabled={loading}>{loading ? 'Please wait...' : 'Sign in'}</button>}
        {isStaffRegistration && invitation && <button className="primary auth-submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>}
      </form>

      <div className="auth-switch">
        {isRecovery ? <>Remembered your password? <button type="button" onClick={() => { setError(''); setMode('login') }}>Sign in</button></> : isLogin ? <>Need a staff account? <button type="button" onClick={() => { setError(''); setMode('register'); setForm(current => ({ ...current, role: 'STAFF' })); setInvitation(null) }}>Register</button><span> · </span><button type="button" onClick={() => { setError(''); setMode('recovery'); setRecovery(current => ({ ...current, email: form.email })) }}>Forgot developer password?</button></> : <>Already registered? <button type="button" onClick={() => { setError(''); setMode('login'); setInvitation(null) }}>Sign in</button></>}
      </div>
    </section>
  </main>
}

import { useState } from 'react'
import { api } from './api'
import './auth.css'

export default function Auth({ onAuthenticated, onBack }) {
  const activationTokenFromUrl = new URLSearchParams(window.location.hash.slice(1)).get('churchActivation') || ''
  const [mode, setMode] = useState(activationTokenFromUrl ? 'activate' : 'login')
  const [application, setApplication] = useState({ churchName: '', denomination: '', address: '', applicantName: '', applicantEmail: '', phone: '' })
  const [applicationSubmitted, setApplicationSubmitted] = useState(null)
  const [notice, setNotice] = useState('')
  const [activationToken] = useState(activationTokenFromUrl)
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

      if (mode === 'apply') {
        const result = await api.applyForChurch({
          ...application,
          churchName: application.churchName.trim(),
          applicantName: application.applicantName.trim(),
          applicantEmail: application.applicantEmail.trim().toLowerCase(),
        })
        setApplicationSubmitted(result.application)
        setNotice(result.message || 'Application submitted for review.')
        return
      }

      if (mode === 'activate') {
        if (form.password !== form.confirmPassword) throw new Error('Passwords do not match')
        const result = await api.activateChurchApplication({ token: activationToken, password: form.password })
        setNotice(result.message || 'Account activated. You can now sign in.')
        setError('')
        setForm(current => ({ ...current, password: '', confirmPassword: '' }))
        window.history.replaceState({}, '', window.location.pathname)
        setMode('login')
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
  const isApplication = mode === 'apply'
  const isActivation = mode === 'activate'
  const isStaffRegistration = mode === 'register' && form.role === 'STAFF'

  return <main className="auth-shell">
    <section className="auth-card">
      {onBack && <button type="button" className="auth-back" onClick={onBack}>← Back to website</button>}
      <div className="auth-brand"><span>L</span><div><b>Living Bells</b><small>Church operations</small></div></div>
      <span className="eyebrow">Secure workspace</span>
      <h1>{isRecovery ? 'Recover developer access' : isApplication ? 'Apply for Living Bells' : isActivation ? 'Activate your church account' : isLogin ? 'Welcome back' : 'Create your staff account'}</h1>
      <p className="auth-subtitle">
        {isRecovery
          ? 'Use the recovery key generated for your developer account. You can view it again from Developer Console → Security.'
          : isApplication
            ? 'Submit your church details. Your application stays pending until the Living Bells developer team reviews it.'
            : isActivation
              ? 'Choose a password to activate the administrator account for your approved church.'
              : isLogin
                ? 'Sign in with your email and password.'
                : 'Staff registration uses a code provided by your church admin.'}
      </p>

      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <div className="auth-notice" role="status">{notice}</div>}
      {applicationSubmitted && isApplication && <div className="auth-application-status" role="status">
        <b>Application #{applicationSubmitted.id} received</b>
        <span>Status: Pending developer review</span>
        <span>We will review the details before any administrator account is activated.</span>
      </div>}

      <form onSubmit={submit}>
        {isApplication && !applicationSubmitted && <>
          <label>Church name<input value={application.churchName} onChange={e => setApplication(current => ({ ...current, churchName: e.target.value }))} autoComplete="organization" required /></label>
          <label>Denomination (optional)<input value={application.denomination} onChange={e => setApplication(current => ({ ...current, denomination: e.target.value }))} /></label>
          <label>Church address or location (optional)<input value={application.address} onChange={e => setApplication(current => ({ ...current, address: e.target.value }))} autoComplete="street-address" /></label>
          <label>Applicant full name<input value={application.applicantName} onChange={e => setApplication(current => ({ ...current, applicantName: e.target.value }))} autoComplete="name" required /></label>
          <label>Contact email<input type="email" value={application.applicantEmail} onChange={e => setApplication(current => ({ ...current, applicantEmail: e.target.value }))} autoComplete="email" required /></label>
          <label>Phone (optional)<input type="tel" value={application.phone} onChange={e => setApplication(current => ({ ...current, phone: e.target.value }))} autoComplete="tel" /></label>
        </>}

        {isRecovery && <>
          <label>Developer email<input type="email" value={recovery.email} onChange={e => setRecovery(current => ({ ...current, email: e.target.value }))} autoComplete="email" required /></label>
          <label>Recovery key<input type="text" value={recovery.recoveryKey} onChange={e => setRecovery(current => ({ ...current, recoveryKey: e.target.value.toUpperCase() }))} autoComplete="off" placeholder="LB-XXXXX-XXXXX-XXXXX-XXXXX" required /></label>
          <label>New password<input type="password" minLength="8" value={recovery.password} onChange={e => setRecovery(current => ({ ...current, password: e.target.value }))} autoComplete="new-password" required /></label>
          <label>Confirm new password<input type="password" minLength="8" value={recovery.confirmPassword} onChange={e => setRecovery(current => ({ ...current, confirmPassword: e.target.value }))} autoComplete="new-password" required /></label>
          <button className="primary auth-submit" disabled={loading}>{loading ? 'Recovering…' : 'Reset developer password'}</button>
        </>}
        {mode === 'register' && <label>Account type<select value={form.role} onChange={e => { update('role', e.target.value); setInvitation(null); setError('') }}><option value="STAFF">Staff</option></select></label>}

        {mode === 'register' && form.role === 'ADMIN' && <>
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


        {(!isRecovery && !isApplication && (isLogin || isActivation || (mode === 'register' && invitation))) && <>
          {isLogin && <label>Email<input type="email" value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" required /></label>}
          <label>Password<input type="password" minLength="8" value={form.password} onChange={e => update('password', e.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} required /></label>
          {(isActivation || mode === 'register') && <label>Confirm password<input type="password" minLength="8" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} autoComplete="new-password" required /></label>}
        </>}

        {isApplication && !applicationSubmitted && <button className="primary auth-submit" disabled={loading}>{loading ? 'Submitting application…' : 'Submit church application'}</button>}
        {isActivation && <button className="primary auth-submit" disabled={loading}>{loading ? 'Activating…' : 'Activate administrator account'}</button>}
        {isLogin && <button className="primary auth-submit" disabled={loading}>{loading ? 'Please wait...' : 'Sign in'}</button>}
        {isStaffRegistration && invitation && <button className="primary auth-submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>}
      </form>

      <div className="auth-switch">
        {isRecovery ? <>Remembered your password? <button type="button" onClick={() => { setError(''); setMode('login') }}>Sign in</button></>
          : isApplication ? <>Already have an account? <button type="button" onClick={() => { setError(''); setNotice(''); setApplicationSubmitted(null); setMode('login') }}>Sign in</button></>
            : isActivation ? <>Have an activation problem? <button type="button" onClick={() => { setError(''); setMode('login') }}>Return to sign in</button></>
              : isLogin ? <>Need a staff account? <button type="button" onClick={() => { setError(''); setMode('register'); setForm(current => ({ ...current, role: 'STAFF' })); setInvitation(null) }}>Register with staff code</button><span> · </span><button type="button" onClick={() => { setError(''); setNotice(''); setApplicationSubmitted(null); setMode('apply') }}>Apply for a church account</button><span> · </span><button type="button" onClick={() => { setError(''); setMode('recovery'); setRecovery(current => ({ ...current, email: form.email })) }}>Forgot developer password?</button></>
                : <>Already registered? <button type="button" onClick={() => { setError(''); setMode('login'); setInvitation(null) }}>Sign in</button></>}
      </div>
    </section>
  </main>
}

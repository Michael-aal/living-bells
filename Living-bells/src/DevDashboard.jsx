import { useEffect, useState } from 'react'
import { api } from './api'
import './DevDashboard.css'

function token() {
  return localStorage.getItem('living_bells_token') || ''
}

async function request(path, options = {}) {
  const response = await fetch((import.meta.env.VITE_API_BASE_URL || '') + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Developer request failed')
  return data
}

function date(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Stat({ label, value, hint }) {
  return <article className="dev-stat">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{hint}</small>
  </article>
}

export default function DevDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [staff, setStaff] = useState([])
  const [invitations, setInvitations] = useState([])
  const [developers, setDevelopers] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [devForm, setDevForm] = useState({ name: '', email: '', password: '' })
  const [devSaving, setDevSaving] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [recoveryVisible, setRecoveryVisible] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [overviewData, staffData, invitationData, developerData] = await Promise.all([
        api.devOverview(),
        request('/api/admin/staff'),
        request('/api/admin/staff/invitations'),
        request('/api/dev/developers'),
        api.notifications(),
      ])
      setOverview(overviewData)
      setStaff(staffData || [])
      setInvitations(invitationData || [])
      setDevelopers(developerData || [])
      setNotifications(notificationData || [])
    } catch (err) {
      setError(err.message || 'Could not load the developer console')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function loadRecoveryKey() {
    setError('')
    try {
      const result = await api.devRecoveryKey()
      setRecoveryKey(result.recoveryKey || '')
      setRecoveryVisible(true)
    } catch (err) { setError(err.message || 'Could not load the recovery key') }
  }

  async function markNotificationRead(id) {
    try {
      await api.markNotificationRead(id)
      setNotifications(current => current.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
    } catch (err) { setError(err.message || 'Could not update notification') }
  }

  async function changePassword(event) {
    event.preventDefault()
    setNotice('')
    setError('')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    setPasswordSaving(true)
    try {
      await api.changeDevPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setNotice('Developer password changed successfully.')
    } catch (err) {
      setError(err.message || 'Could not change developer password')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function addDeveloper(event) {
    event.preventDefault()
    setNotice('')
    setError('')
    setDevSaving(true)
    try {
      await request('/api/dev/developers', { method: 'POST', body: JSON.stringify(devForm) })
      setDevForm({ name: '', email: '', password: '' })
      setNotice('Developer account created.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not create developer account')
    } finally {
      setDevSaving(false)
    }
  }

  const users = overview?.users || {}
  const records = overview?.records || {}
  const tabs = [
    ['overview', 'Overview'],
    ['users', 'Users'],
    ['invitations', 'Invitations'],
    ['developers', 'Developers'],
    ['security', 'Security'],
  ]

  return <div className="dev-console">
    <header className="dev-header">
      <div className="dev-header-inner">
        <div className="dev-brand">
          <div className="dev-logo">L</div>
          <div>
            <span>Living Bells</span>
            <strong>Developer Console</strong>
          </div>
        </div>
        <div className="dev-account">
          <div className="dev-account-copy">
            <strong>{user.name || 'Developer'}</strong>
            <span>{user.email}</span>
          </div>
          <div className="dev-notification-wrap">
            <button className="dev-bell" aria-label="Notifications" onClick={() => setNotificationsOpen(value => !value)}>♢<span className="dev-notification-count">{notifications.filter(item => !item.readAt).length}</span></button>
            {notificationsOpen && <div className="dev-notification-panel">
              <div className="dev-notification-head"><strong>Notifications</strong><span>{notifications.filter(item => !item.readAt).length} unread</span></div>
              {!notifications.length && <div className="dev-empty">No notifications yet.</div>}
              {notifications.map(item => <button key={item.id} className={item.readAt ? 'dev-notification read' : 'dev-notification'} onClick={() => markNotificationRead(item.id)}><strong>{item.title}</strong><span>{item.message}</span><small>{date(item.createdAt)}</small></button>)}
            </div>}
          </div>
          <button className="dev-ghost" onClick={onLogout}>Log out</button>
        </div>
      </div>
    </header>

    <main className="dev-main">
      <section className="dev-hero">
        <div>
          <span className="dev-eyebrow">Platform administration</span>
          <h1>Dev Console</h1>
          <p>Monitor the Living Bells platform, manage privileged developer access, and inspect real system data.</p>
        </div>
        <div className="dev-health"><i /> <span>System operational</span></div>
      </section>

      <nav className="dev-tabs" aria-label="Developer console sections">
        {tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
        <button className="refresh" onClick={load}>Refresh</button>
      </nav>

      {notice && <div className="dev-notice">{notice}</div>}
      {error && <div className="dev-error">{error}</div>}

      {loading ? <section className="dev-panel dev-loading">Loading platform data…</section> : <>
        {tab === 'overview' && <div className="dev-content">
          <div className="dev-stats">
            <Stat label="Total users" value={users.total ?? 0} hint={`${users.active ?? 0} active accounts`} />
            <Stat label="Staff" value={users.staff ?? 0} hint={`${overview?.pendingInvitations ?? 0} pending invitations`} />
            <Stat label="Administrators" value={users.admins ?? 0} hint="Church admin accounts" />
            <Stat label="Developers" value={users.developers ?? 0} hint="Privileged platform accounts" />
          </div>

          <div className="dev-two-col">
            <section className="dev-panel">
              <div className="dev-panel-head"><div><span className="dev-eyebrow">Database activity</span><h2>Platform records</h2></div><span className="dev-live">Live counts</span></div>
              <div className="dev-record-grid">
                <div><b>{records.activities ?? 0}</b><span>Activities</span></div>
                <div><b>{records.attendance ?? 0}</b><span>Attendance</span></div>
                <div><b>{records.finances ?? 0}</b><span>Financial records</span></div>
                <div><b>{records.weeklyReports ?? 0}</b><span>Weekly reports</span></div>
              </div>
            </section>

            <section className="dev-panel">
              <div className="dev-panel-head"><div><span className="dev-eyebrow">Reporting</span><h2>Latest weekly report</h2></div></div>
              {overview?.latestReport ? <div className="dev-latest"><strong>{date(overview.latestReport.reportDate)}</strong><span>Last updated {date(overview.latestReport.updatedAt)}</span></div> : <div className="dev-empty">No weekly reports have been recorded yet.</div>}
            </section>
          </div>

          <section className="dev-panel">
            <div className="dev-panel-head"><div><span className="dev-eyebrow">Access</span><h2>Security boundary</h2></div></div>
            <div className="dev-security-note"><div className="dev-lock">✓</div><div><strong>Developer-only console</strong><p>Normal registration cannot create developer accounts. Developer access is assigned by the backend and protected by the DEV role.</p></div></div>
          </section>
        </div>}

        {tab === 'users' && <section className="dev-panel">
          <div className="dev-panel-head"><div><span className="dev-eyebrow">Church accounts</span><h2>Staff directory</h2><p>Read-only platform view of church staff accounts.</p></div></div>
          <div className="dev-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Position</th><th>Records</th><th>Status</th></tr></thead><tbody>
            {staff.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.email}</td><td>{item.department || '—'}</td><td>{item.position || '—'}</td><td>{item.recordCount ?? 0}</td><td><span className={item.isActive ? 'dev-status ok' : 'dev-status off'}>{item.isActive ? 'Active' : 'Inactive'}</span></td></tr>)}
          </tbody></table>{!staff.length && <div className="dev-empty">No staff accounts found.</div>}</div>
        </section>}

        {tab === 'invitations' && <section className="dev-panel">
          <div className="dev-panel-head"><div><span className="dev-eyebrow">Onboarding</span><h2>Staff invitations</h2><p>Invitation state is read directly from the backend.</p></div></div>
          <div className="dev-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Position</th><th>Status</th><th>Expires</th></tr></thead><tbody>
            {invitations.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.email}</td><td>{item.department}</td><td>{item.position || '—'}</td><td><span className="dev-status">{item.status || 'Unused'}</span></td><td>{date(item.expiresAt)}</td></tr>)}
          </tbody></table>{!invitations.length && <div className="dev-empty">No invitations found.</div>}</div>
        </section>}

        {tab === 'developers' && <section className="dev-panel">
          <div className="dev-panel-head"><div><span className="dev-eyebrow">Privileged access</span><h2>Developer accounts</h2><p>Only an authenticated developer can provision another developer.</p></div></div>
          <form className="dev-form" onSubmit={addDeveloper}>
            <label>Name<input value={devForm.name} onChange={e => setDevForm({ ...devForm, name: e.target.value })} required /></label>
            <label>Email<input type="email" value={devForm.email} onChange={e => setDevForm({ ...devForm, email: e.target.value })} required /></label>
            <label>Temporary password<input type="password" minLength="8" value={devForm.password} onChange={e => setDevForm({ ...devForm, password: e.target.value })} required /></label>
            <button className="dev-primary" disabled={devSaving}>{devSaving ? 'Creating…' : 'Create developer'}</button>
          </form>
          <div className="dev-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Created</th></tr></thead><tbody>
            {developers.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.email}</td><td><span className={item.isActive ? 'dev-status ok' : 'dev-status off'}>{item.isActive ? 'Active' : 'Inactive'}</span></td><td>{date(item.createdAt)}</td></tr>)}
          </tbody></table></div>
        </section>}

        {tab === 'security' && <section className="dev-two-col">
          <div className="dev-panel">
            <div className="dev-panel-head"><div><span className="dev-eyebrow">Account security</span><h2>Change developer password</h2><p>Update the password for the current developer account.</p></div></div>
            <form className="dev-password" onSubmit={changePassword}>
              <label>Current password<input type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required /></label>
              <label>New password<input type="password" minLength="8" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required /></label>
              <label>Confirm new password<input type="password" minLength="8" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required /></label>
              <button className="dev-primary" disabled={passwordSaving}>{passwordSaving ? 'Saving…' : 'Change password'}</button>
            </form>
          </div>
          <div className="dev-panel dev-credentials">
            <span className="dev-eyebrow">Recovery</span>
            <h2>Developer recovery key</h2>
            <p>Use this key to recover the developer account if the password is forgotten. It is encrypted at rest and only revealed after authenticated developer access.</p>
            {recoveryVisible ? <div className="dev-recovery-display">{recoveryKey}<button type="button" onClick={() => navigator.clipboard?.writeText(recoveryKey)}>Copy</button></div> : <button type="button" className="dev-primary" onClick={loadRecoveryKey}>View recovery key</button>}
            <div className="dev-credentials-divider" />
            <span className="dev-eyebrow">Developer identity</span>
            <h2>{user.email}</h2>
            <p>This account is created by the backend bootstrap process, not the normal registration page.</p>
            <div><span>Role</span><strong>DEV</strong></div>
            <div><span>Authentication</span><strong>JWT + bcrypt</strong></div>
            <div><span>Registration</span><strong>Backend only</strong></div>
          </div>
        </section>}
      </>}
    </main>
  </div>
}

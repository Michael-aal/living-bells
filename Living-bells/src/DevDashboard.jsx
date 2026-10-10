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
  const [invitations, setInvitations] = useState([])
  const [developers, setDevelopers] = useState([])
  const [directory, setDirectory] = useState([])
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
  const [applications, setApplications] = useState([])
  const [applicationNotes, setApplicationNotes] = useState({})
  const [activationLink, setActivationLink] = useState('')
  const [activationEmailRetryId, setActivationEmailRetryId] = useState(null)
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketMessages, setTicketMessages] = useState([])
  const [ticketReply, setTicketReply] = useState('')
  const [ticketInternal, setTicketInternal] = useState(false)

  async function load({ initial = false } = {}) {
    if (!initial) {
      setLoading(true)
      setError('')
    }
    try {
      const [overviewData, directoryData, invitationData, developerData, notificationData, applicationData, ticketData] = await Promise.all([
        api.devOverview(),
        request('/api/dev/users'),
        request('/api/admin/staff/invitations'),
        request('/api/dev/developers'),
        api.notifications(),
        api.churchApplications(),
        api.supportTickets(),
      ])
      setOverview({ ...overviewData, users: directoryData?.counts || overviewData?.users || {} })
      setDirectory(directoryData?.users || [])
      setInvitations(invitationData || [])
      setDevelopers(developerData || [])
      setNotifications(notificationData || [])
      setApplications(applicationData || [])
      setTickets(ticketData || [])
    } catch (err) {
      setError(err.message || 'Could not load the developer console')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { Promise.resolve().then(() => load({ initial: true })) }, [])

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


  async function reviewApplication(id, action) {
    setError('')
    setNotice('')
    setActivationLink('')
    try {
      const result = await api.reviewChurchApplication(id, { action, note: applicationNotes[id] || '' })
      if (result.activationLink) setActivationLink(result.activationLink)
      setActivationEmailRetryId(result.emailDeliveryFailed ? id : null)
      setNotice(result.message || 'Application updated.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not review church application')
    }
  }

  async function resendActivationEmail(id) {
    setError('')
    setNotice('')
    try {
      const result = await api.resendChurchActivation(id)
      setActivationEmailRetryId(null)
      setNotice(result.message || 'Activation email sent.')
    } catch (err) {
      setError(err.message || 'Could not resend the activation email')
    }
  }

  async function openTicket(ticket) {
    setSelectedTicket(ticket)
    setTicketReply('')
    setTicketInternal(false)
    setError('')
    try {
      setTicketMessages(await api.supportTicketMessages(ticket.id))
    } catch (err) {
      setError(err.message || 'Could not load ticket conversation')
    }
  }

  async function sendTicketReply(event) {
    event.preventDefault()
    if (!selectedTicket || !ticketReply.trim()) return
    setError('')
    setNotice('')
    try {
      await api.addSupportTicketMessage(selectedTicket.id, { body: ticketReply.trim(), internal: ticketInternal })
      setTicketReply('')
      setTicketMessages(await api.supportTicketMessages(selectedTicket.id))
      setNotice('Reply sent.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not send support reply')
    }
  }

  async function setTicketStatus(ticket, status) {
    setError('')
    try {
      await api.updateSupportTicket(ticket.id, { status, priority: ticket.priority || 'NORMAL' })
      setTickets(current => current.map(item => item.id === ticket.id ? { ...item, status } : item))
      if (selectedTicket?.id === ticket.id) setSelectedTicket(current => ({ ...current, status }))
      setNotice('Ticket status updated.')
    } catch (err) {
      setError(err.message || 'Could not update ticket status')
    }
  }

  const users = overview?.users || {}
  const records = overview?.records || {}
  const tabs = [
    ['overview', 'Overview'],
    ['applications', `Church applications ${applications.filter(item => item.status === 'PENDING' || item.status === 'NEEDS_INFO').length ? `(${applications.filter(item => item.status === 'PENDING' || item.status === 'NEEDS_INFO').length})` : ''}`],
    ['support', `Support tickets ${tickets.filter(item => !['RESOLVED', 'CLOSED'].includes(item.status)).length ? `(${tickets.filter(item => !['RESOLVED', 'CLOSED'].includes(item.status)).length})` : ''}`],
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
            <button className="dev-bell" aria-label="Notifications" onClick={() => setNotificationsOpen(value => !value)}><svg className="dev-bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><span className="dev-notification-count">{notifications.filter(item => !item.readAt).length}</span></button>
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


        {tab === 'applications' && <section className="dev-panel">
          <div className="dev-panel-head"><div><span className="dev-eyebrow">Approval queue</span><h2>Church applications</h2><p>New churches remain pending until a developer reviews them. Approval creates a church workspace and a time-limited activation link.</p></div><span className="dev-live">{applications.filter(item => item.status === 'PENDING' || item.status === 'NEEDS_INFO').length} awaiting review</span></div>
          {activationLink && <div className="dev-activation-link"><strong>One-time activation link</strong><p>Share this link privately with the applicant. It expires in 72 hours and can be used once.</p><input readOnly value={activationLink} aria-label="Church administrator activation link" /><button type="button" className="dev-primary" onClick={() => navigator.clipboard?.writeText(activationLink)}>Copy activation link</button></div>}
          {activationEmailRetryId && <div className="dev-activation-link"><strong>Activation email delivery needs a retry</strong><p>The application is approved, but the email provider did not confirm delivery. The one-time link is not shown here in production.</p><button type="button" className="dev-primary" onClick={() => resendActivationEmail(activationEmailRetryId)}>Retry activation email</button></div>}
          <div className="dev-application-grid">
            {applications.map(item => <article className="dev-application-card" key={item.id}>
              <div className="dev-panel-head"><div><span className="dev-eyebrow">Application #{item.id}</span><h3>{item.churchName}</h3></div><span className={item.status === 'ACTIVATED' ? 'dev-status ok' : item.status === 'REJECTED' ? 'dev-status off' : 'dev-status'}>{item.status.replaceAll('_', ' ')}</span></div>
              <div className="dev-application-details"><span><b>Applicant</b>{item.applicantName}</span><span><b>Email</b>{item.applicantEmail}</span><span><b>Denomination</b>{item.denomination || '—'}</span><span><b>Location</b>{item.address || '—'}</span><span><b>Phone</b>{item.phone || '—'}</span><span><b>Submitted</b>{date(item.createdAt)}</span></div>
              {item.reviewNote && <p className="dev-application-note"><b>Review note:</b> {item.reviewNote}</p>}
              {(item.status === 'PENDING' || item.status === 'NEEDS_INFO') && <>
                <label className="dev-review-note">Review note / reason<textarea value={applicationNotes[item.id] || ''} onChange={e => setApplicationNotes(current => ({ ...current, [item.id]: e.target.value }))} placeholder="Optional note; required for rejection or more information." rows="2" /></label>
                <div className="dev-actions"><button type="button" className="dev-primary" onClick={() => reviewApplication(item.id, 'APPROVE')}>Approve</button><button type="button" className="dev-secondary" onClick={() => reviewApplication(item.id, 'NEEDS_INFO')}>Request information</button><button type="button" className="dev-danger" onClick={() => reviewApplication(item.id, 'REJECT')}>Reject</button></div>
              </>}
            </article>)}
          </div>
          {!applications.length && <div className="dev-empty">No church applications yet.</div>}
        </section>}

        {tab === 'support' && <section className="dev-panel">
          <div className="dev-panel-head"><div><span className="dev-eyebrow">Customer support</span><h2>Support desk</h2><p>Review church issues, reply to administrators, and track resolution.</p></div><span className="dev-live">{tickets.length} total tickets</span></div>
          <div className="dev-ticket-layout">
            <div className="dev-ticket-list">
              {tickets.map(ticket => <button type="button" key={ticket.id} className={selectedTicket?.id === ticket.id ? 'dev-ticket-item active' : 'dev-ticket-item'} onClick={() => openTicket(ticket)}>
                <strong>#{ticket.id} · {ticket.title}</strong><span>{ticket.church?.name || 'Church'} · {ticket.createdBy?.email || 'Unknown requester'}</span><small>{ticket.status.replaceAll('_', ' ')} · {date(ticket.updatedAt)}</small>
              </button>)}
              {!tickets.length && <div className="dev-empty">No support tickets yet.</div>}
            </div>
            <div className="dev-ticket-detail">
              {!selectedTicket ? <div className="dev-empty">Choose a ticket to inspect its conversation.</div> : <>
                <div className="dev-panel-head"><div><span className="dev-eyebrow">Ticket #{selectedTicket.id}</span><h3>{selectedTicket.title}</h3><p>{selectedTicket.church?.name || 'Church'} · {selectedTicket.category}</p></div></div>
                <p>{selectedTicket.description}</p>
                <label className="dev-review-note">Status<select value={selectedTicket.status} onChange={e => setTicketStatus(selectedTicket, e.target.value)}>{['OPEN','IN_PROGRESS','WAITING_FOR_CHURCH','RESOLVED','CLOSED'].map(status => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label>
                <div className="dev-ticket-messages">{ticketMessages.map(message => <article key={message.id} className={message.internal ? 'dev-ticket-message internal' : 'dev-ticket-message'}><div><strong>{message.author?.name || 'User'}</strong><small>{date(message.createdAt)}{message.internal ? ' · Internal note' : ''}</small></div><p>{message.body}</p></article>)}{!ticketMessages.length && <div className="dev-empty">No replies yet.</div>}</div>
                <form className="dev-ticket-reply" onSubmit={sendTicketReply}><label>Reply<textarea rows="3" value={ticketReply} onChange={e => setTicketReply(e.target.value)} placeholder="Write a helpful response…" required /></label><label className="dev-checkbox"><input type="checkbox" checked={ticketInternal} onChange={e => setTicketInternal(e.target.checked)} /> Internal developer note (not visible to the church)</label><button className="dev-primary" disabled={!ticketReply.trim()}>Send reply</button></form>
              </>}
            </div>
          </div>
        </section>}

        {tab === 'users' && <section className="dev-panel">
          <div className="dev-panel-head"><div><span className="dev-eyebrow">Database truth</span><h2>All platform accounts</h2><p>Every account below is read directly from the User table. No placeholder counts.</p></div><span className="dev-live">Database source</span></div>
          <div className="dev-account-summary">
            {['ADMIN', 'STAFF', 'DEV'].map(role => <div key={role}><span>{role === 'ADMIN' ? 'Administrators' : role === 'STAFF' ? 'Staff' : 'Developers'}</span><strong>{directory.filter(item => item.role === role).length}</strong></div>)}
          </div>
          <div className="dev-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Position</th><th>Status</th><th>Created</th></tr></thead><tbody>
            {directory.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.email}</td><td><span className="dev-status">{item.role}</span></td><td>{item.department || '—'}</td><td>{item.position || '—'}</td><td><span className={item.isActive ? 'dev-status ok' : 'dev-status off'}>{item.isActive ? 'Active' : 'Inactive'}</span></td><td>{date(item.createdAt)}</td></tr>)}
          </tbody></table>{!directory.length && <div className="dev-empty">The database returned no user accounts.</div>}</div>
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

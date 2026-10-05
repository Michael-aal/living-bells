import { useEffect, useMemo, useState } from 'react'

function token() {
  return localStorage.getItem('living_bells_token') || ''
}

async function request(path, options = {}) {
  const response = await fetch(path, {
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

export default function DevDashboard({ user, onLogout }) {
  const [staff, setStaff] = useState([])
  const [invitations, setInvitations] = useState([])
  const [counts, setCounts] = useState({ active: 0, pending: 0, total: 0 })
  const [dashboard, setDashboard] = useState(null)
  const [developers, setDevelopers] = useState([])
  const [devForm, setDevForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState('overview')

  async function load() {
    setLoading(true)
    try {
      const [staffData, invitationData, countData, dashboardData, developersData] = await Promise.all([
        request('/api/admin/staff'),
        request('/api/admin/staff/invitations'),
        request('/api/admin/staff/count'),
        request('/api/dashboard'),
        request('/api/dev/developers'),
      ])
      setStaff(staffData || [])
      setInvitations(invitationData || [])
      setCounts(countData || { active: 0, pending: 0, total: 0 })
      setDashboard(dashboardData || {})
      setDevelopers(developersData || [])
      setMessage('')
    } catch (error) {
      setMessage(error.message || 'Could not load developer console')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const verified = useMemo(() => staff.filter(item => item.emailVerified).length, [staff])
  const active = useMemo(() => staff.filter(item => item.isActive !== false).length, [staff])
  const recentStaff = useMemo(() => staff.slice(0, 8), [staff])

  async function addDeveloper(event) {
    event.preventDefault()
    setMessage('')
    try {
      await request('/api/dev/developers', { method: 'POST', body: JSON.stringify(devForm) })
      setDevForm({ name: '', email: '', password: '' })
      await load()
      setMessage('Developer account onboarded.')
    } catch (error) {
      setMessage(error.message || 'Could not onboard developer')
    }
  }


  return (
    <div className="dev-console">
      <style>{`
        .dev-console{min-height:100vh;background:#f7f7fb;color:#17131f;font-family:Inter,system-ui,-apple-system,sans-serif}
        .dev-shell{max-width:1240px;margin:0 auto;padding:24px}
        .dev-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:28px}
        .dev-brand{display:flex;align-items:center;gap:12px}.dev-mark{width:40px;height:40px;border-radius:12px;background:#6d3df5;color:white;display:grid;place-items:center;font-weight:800}
        .dev-kicker{font-size:12px;color:#766f82;text-transform:uppercase;letter-spacing:.12em}.dev-title{font-size:24px;font-weight:800;margin:2px 0}
        .dev-user{display:flex;align-items:center;gap:12px}.dev-user small{color:#766f82}.dev-btn{border:1px solid #ddd8e8;background:white;border-radius:10px;padding:9px 13px;cursor:pointer}
        .dev-nav{display:flex;gap:8px;margin-bottom:20px;overflow:auto}.dev-nav button{border:0;background:transparent;padding:9px 13px;border-radius:9px;cursor:pointer;color:#625b70}.dev-nav button.active{background:#eee8ff;color:#5c2bd9;font-weight:700}
        .dev-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.dev-card{background:white;border:1px solid #e7e2ef;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(28,18,45,.04)}
        .dev-label{font-size:13px;color:#766f82}.dev-value{font-size:28px;font-weight:800;margin-top:8px}.dev-sub{font-size:12px;color:#8a8395;margin-top:4px}
        .dev-section{margin-top:18px}.dev-section h2{font-size:16px;margin:0 0 12px}.dev-table{width:100%;border-collapse:collapse}.dev-table th,.dev-table td{text-align:left;padding:12px 10px;border-bottom:1px solid #eeeaf2;font-size:13px}.dev-table th{color:#766f82;font-weight:600}
        .dev-pill{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700;background:#eeeaf4}.dev-pill.ok{background:#e8f7ed;color:#247342}.dev-pill.warn{background:#fff3db;color:#986000}
        .dev-banner{padding:12px 14px;border-radius:10px;background:#fff3db;color:#7a5100;margin-bottom:16px}.dev-empty{color:#8a8395;padding:18px 0}
        @media(max-width:800px){.dev-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dev-top{align-items:flex-start}.dev-user span{display:none}}
        @media(max-width:520px){.dev-shell{padding:16px}.dev-grid{grid-template-columns:1fr 1fr}.dev-value{font-size:23px}.dev-table{min-width:650px}.dev-section{overflow-x:auto}}
      `}</style>
      <div className="dev-shell">
        <header className="dev-top">
          <div className="dev-brand"><div className="dev-mark">L</div><div><div className="dev-kicker">Developer Console</div><div className="dev-title">Living Bells Platform</div></div></div>
          <div className="dev-user"><div><strong>{user.name || 'Developer'}</strong><br/><small>{user.email}</small></div><button className="dev-btn" onClick={onLogout}>Log out</button></div>
        </header>

        <nav className="dev-nav">
          {['overview','users','invitations'].map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}
          <button className={tab === 'developers' ? 'active' : ''} onClick={() => setTab('developers')}>Developers</button><button onClick={load}>Refresh</button>
        </nav>

        {message && <div className="dev-banner">{message}</div>}
        {loading ? <div className="dev-card">Loading developer console…</div> : (
          <>
            {tab === 'overview' && <>
              <section className="dev-grid">
                <div className="dev-card"><div className="dev-label">Active staff</div><div className="dev-value">{active}</div><div className="dev-sub">{counts.pending} pending invitations</div></div>
                <div className="dev-card"><div className="dev-label">Verified accounts</div><div className="dev-value">{verified}</div><div className="dev-sub">Email verification status</div></div>
                <div className="dev-card"><div className="dev-label">Activities</div><div className="dev-value">{dashboard?.activities?.length ?? 0}</div><div className="dev-sub">Latest records loaded</div></div>
                <div className="dev-card"><div className="dev-label">Console access</div><div className="dev-value">DEV</div><div className="dev-sub">Protected platform role</div></div>
              </section>
              <section className="dev-section dev-card"><h2>Recent onboarded staff</h2>{recentStaff.length ? <table className="dev-table"><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Status</th></tr></thead><tbody>{recentStaff.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.department || '—'}</td><td><span className={`dev-pill ${item.isActive !== false ? 'ok' : 'warn'}`}>{item.isActive !== false ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table> : <div className="dev-empty">No staff accounts yet.</div>}</section>
            </>}
            {tab === 'users' && <section className="dev-section dev-card"><h2>Staff accounts</h2><table className="dev-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Records</th><th>Status</th></tr></thead><tbody>{staff.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td><td>{item.department || '—'}</td><td>{item.recordCount ?? 0}</td><td>{item.isActive !== false ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></section>}
            {tab === 'developers' && <section className="dev-section dev-card">
              <h2>Developer access</h2>
              <p className="dev-sub">Only developers can create another developer account.</p>
              <form onSubmit={addDeveloper} style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,margin:'14px 0 22px'}}>
                <input value={devForm.name} onChange={e => setDevForm({...devForm,name:e.target.value})} placeholder="Name" required style={{padding:10,border:'1px solid #ddd8e8',borderRadius:9}} />
                <input type="email" value={devForm.email} onChange={e => setDevForm({...devForm,email:e.target.value})} placeholder="Email" required style={{padding:10,border:'1px solid #ddd8e8',borderRadius:9}} />
                <input type="password" value={devForm.password} onChange={e => setDevForm({...devForm,password:e.target.value})} placeholder="Temporary password (8+)" minLength="8" required style={{padding:10,border:'1px solid #ddd8e8',borderRadius:9}} />
                <button className="dev-btn" type="submit" style={{width:'fit-content'}}>Onboard developer</button>
              </form>
              <table className="dev-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Joined</th></tr></thead><tbody>{developers.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.isActive ? 'Active' : 'Inactive'}</td><td>{new Date(item.createdAt).toLocaleDateString('en-NG')}</td></tr>)}</tbody></table>
            </section>}
            {tab === 'invitations' && <section className="dev-section dev-card"><h2>Staff onboarding</h2><table className="dev-table"><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Status</th><th>Created</th></tr></thead><tbody>{invitations.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.department}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleDateString('en-NG')}</td></tr>)}</tbody></table></section>}
          </>
        )}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Auth from './Auth'
import { api } from './api'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function normalizeAttendance(record) {
  const activity = record.activity || {}
  const total = [
    'childrenMale', 'childrenFemale', 'teenagersMale', 'teenagersFemale',
    'youthMale', 'youthFemale', 'adultsMale', 'adultsFemale',
  ].reduce((sum, key) => sum + Number(record[key] || 0), 0)

  return {
    ...record,
    service: activity.name || 'Service',
    date: formatDate(activity.date),
    total,
  }
}

function normalizeExpense(record) {
  return {
    ...record,
    title: record.description || 'Expense',
    category: record.category || 'General',
    amount: Number(record.amount || 0),
    date: formatDate(record.date),
  }
}

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('living_bells_user') || 'null') } catch { return null }
  })
  const [page, setPage] = useState('dashboard')
  const [attendance, setAttendance] = useState([])
  const [expenses, setExpenses] = useState([])
  const [activities, setActivities] = useState([])
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState('Connecting...')
  const [query, setQuery] = useState('')

  const money = n => '₦' + Number(n || 0).toLocaleString('en-NG')
  const totalSpend = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses])
  const normalizedQuery = query.trim().toLowerCase()
  const visibleAttendance = useMemo(() => !normalizedQuery ? attendance : attendance.filter(item => `${item.service} ${item.date}`.toLowerCase().includes(normalizedQuery)), [attendance, normalizedQuery])
  const visibleExpenses = useMemo(() => !normalizedQuery ? expenses : expenses.filter(item => `${item.title} ${item.category} ${item.date}`.toLowerCase().includes(normalizedQuery)), [expenses, normalizedQuery])
  const visibleActivities = useMemo(() => !normalizedQuery ? activities : activities.filter(item => `${item.name} ${item.type || ''} ${formatDate(item.date)}`.toLowerCase().includes(normalizedQuery)), [activities, normalizedQuery])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    async function loadData() {
      setLoading(true)
      setSync('Connecting...')
      try {
        const data = await api.dashboard()
        if (cancelled) return
        setAttendance((data.attendance || []).map(normalizeAttendance))
        setExpenses((data.expenses || []).map(normalizeExpense))
        setActivities(data.activities || [])
        setSync('Backend connected')
      } catch (error) {
        if (!cancelled) setSync(error.message || 'Backend unavailable')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [user])

  if (!user) return <Auth onAuthenticated={setUser} />

  function logout() {
    localStorage.removeItem('living_bells_token')
    localStorage.removeItem('living_bells_user')
    setUser(null)
    setAttendance([])
    setExpenses([])
    setActivities([])
  }

  async function addAttendance(payload) {
    try {
      setSync('Saving attendance...')
      const saved = await api.createAttendance(payload)
      setAttendance(current => [normalizeAttendance(saved), ...current.filter(item => item.id !== saved.id)])
      setModal(null)
      setSync('Backend connected')
    } catch (error) {
      setSync(error.message || 'Could not save attendance')
    }
  }

  async function addActivity(payload) {
    try {
      setSync('Saving activity...')
      const saved = await api.createActivity(payload)
      setActivities(current => [saved, ...current.filter(item => item.id !== saved.id)])
      setModal(null)
      setSync('Backend connected')
    } catch (error) {
      setSync(error.message || 'Could not save activity')
    }
  }

  async function addExpense(payload) {
    try {
      setSync('Saving expense...')
      const saved = await api.createExpense(payload)
      setExpenses(current => [normalizeExpense(saved), ...current.filter(item => item.id !== saved.id)])
      setModal(null)
      setSync('Backend connected')
    } catch (error) {
      setSync(error.message || 'Could not save expense')
    }
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo">L</div><div><b>Living Bells</b><small>Church operations</small></div></div>
      <span className="label">Workspace</span>
      {[
        ['dashboard', '⌂', 'Dashboard'], ['attendance', '◉', 'Attendance'], ['expenses', '₦', 'Expenses'],
        ['activities', '▣', 'Activities'], ['reports', '⌁', 'Reports'], ['forms', '□', 'Forms']
      ].map(([id, icon, name]) => <button key={id} className={page === id ? 'nav active' : 'nav'} onClick={() => setPage(id)}><i>{icon}</i>{name}</button>)}
      <div className="side-status"><span /> <div><b>{sync}</b><small>Authenticated API</small></div></div>
    </aside>

    <main>
      <header><div className="mobile-brand"><div className="logo">L</div>Living Bells</div><label className="search">⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records..." aria-label="Search records" /></label><button className="avatar" title="Sign out" onClick={logout}>{user.name?.slice(0, 2).toUpperCase() || 'ST'}</button></header>
      <section className="content">
        <div className="heading">
          <div><span className="eyebrow">Church operations</span><h1>{page === 'dashboard' ? 'Good evening 👋' : title(page)}</h1><p>{subtitle(page)}</p></div>
          <div className="actions"><button className="secondary" onClick={() => setPage('reports')}>View reports</button><button className="primary" onClick={() => setModal('attendance')}>+ Record</button></div>
        </div>

        {loading && <section className="card"><p>Loading your church records...</p></section>}
        {!loading && page === 'dashboard' && <Dashboard attendance={visibleAttendance} expenses={visibleExpenses} activitiesCount={activities.length} spend={totalSpend} money={money} open={setModal} go={setPage} />}
        {!loading && page === 'attendance' && <Records title="Service attendance" eyebrow="Attendance records" action="Record attendance" onAdd={() => setModal('attendance')}><table><thead><tr><th>Service</th><th>Date</th><th>Total people</th><th>Status</th></tr></thead><tbody>{visibleAttendance.map(r => <tr key={r.id}><td><b>{r.service}</b></td><td>{r.date}</td><td><b>{r.total}</b></td><td><span className="pill">Recorded</span></td></tr>)}</tbody></table>{!attendance.length && <p>No attendance records yet.</p>}</Records>}
        {!loading && page === 'expenses' && <Records title="Expenses" eyebrow="Financial records" action="Record expense" onAdd={() => setModal('expense')}><table><thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Amount</th></tr></thead><tbody>{visibleExpenses.map(r => <tr key={r.id}><td><b>{r.title}</b></td><td>{r.category}</td><td>{r.date}</td><td><b>{money(r.amount)}</b></td></tr>)}</tbody></table>{!expenses.length && <p>No expenses recorded yet.</p>}</Records>}
        {!loading && page === 'activities' && <Records title="Activities" eyebrow="Church programs" action="Record activity" onAdd={() => setModal('activity')}><table><thead><tr><th>Name</th><th>Type</th><th>Date</th></tr></thead><tbody>{visibleActivities.map(item => <tr key={item.id}><td><b>{item.name}</b></td><td>{item.type || '—'}</td><td>{formatDate(item.date)}</td></tr>)}</tbody></table>{!activities.length && <p>No activities recorded yet.</p>}</Records>}
        {!loading && page === 'reports' && <div className="report-grid"><Card title="Attendance"><strong className="big">{attendance.reduce((sum, item) => sum + item.total, 0).toLocaleString()}</strong><p>Combined recorded attendance.</p></Card><Card title="Expenses"><strong className="big">{money(totalSpend)}</strong><p>Combined expenses in this workspace.</p></Card></div>}
        {!loading && page === 'forms' && <div className="form-grid"><Action icon="◉" title="Attendance form" text="Children, teenagers, youth, adults, men and women." onClick={() => setModal('attendance')} /><Action icon="₦" title="Expense form" text="Amount, category, description and date." onClick={() => setModal('expense')} /></div>}
      </section>
    </main>

    {modal === 'activity' && <ActivityForm close={() => setModal(null)} save={addActivity} />}
    {modal === 'attendance' && <AttendanceForm close={() => setModal(null)} save={addAttendance} />}
    {modal === 'expense' && <ExpenseForm close={() => setModal(null)} save={addExpense} />}
    <nav className="mobile-nav">{[['dashboard','⌂'],['attendance','◉'],['expenses','₦'],['activities','▣'],['reports','⌁']].map(([id, icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><i>{icon}</i><span>{title(id)}</span></button>)}</nav>
  </div>
}

function Dashboard({ attendance, expenses, activitiesCount, spend, money, open, go }) {
  return <>
    <div className="stats"><Stat icon="◉" name="Attendance" value={attendance[0]?.total || 0} note="Latest service" /><Stat icon="₦" name="Expenses" value={money(spend)} note="Recorded this period" /><Stat icon="▣" name="Activities" value={activitiesCount} note="Church programs" /><Stat icon="⌁" name="Reports" value="Live" note="From database" /></div>
    <div className="quick"><Action icon="◉" title="Record attendance" text="Capture children, teens, youth, adults and men and women." onClick={() => open('attendance')} /><Action icon="₦" title="Record expense" text="Track church spending clearly." onClick={() => open('expense')} /><Action icon="▣" title="Record activity" text="Plan a service, meeting, outreach or church program." onClick={() => open('activity')} /><Action icon="□" title="Open forms" text="Structured recurring records." onClick={() => go('forms')} /></div>
    <div className="dash-grid"><Card title="Attendance trend"><div className="bars">{attendance.slice(0, 7).reverse().map(r => <div className="bar-col" key={r.id}><b>{r.total}</b><div className="bar" style={{ height: Math.max(25, Math.min(100, r.total / 4)) + '%' }} /><small>{r.date.slice(0, 6)}</small></div>)}</div>{!attendance.length && <p>No attendance data yet.</p>}</Card><Card title="Recent spending"><div className="list">{expenses.slice(0, 5).map(e => <div className="row" key={e.id}><span className="mini">{e.title?.[0] || '₦'}</span><div><b>{e.title}</b><small>{e.category}</small></div><strong>{money(e.amount)}</strong></div>)}</div>{!expenses.length && <p>No expenses recorded yet.</p>}</Card></div>
  </>
}

function Stat({ icon, name, value, note }) { return <div className="stat"><span className="stat-icon">{icon}</span><div><small>{name}</small><strong>{value}</strong><em>{note}</em></div></div> }
function Action({ icon, title, text, onClick }) { return <button className="action-card" onClick={onClick}><span className="stat-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><strong>→</strong></button> }
function Card({ title, children }) { return <section className="card"><div className="card-head"><h2>{title}</h2></div>{children}</section> }
function Records({ title, eyebrow, action, onAdd, children }) { return <section className="card full"><div className="card-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="primary" onClick={onAdd}>{action}</button></div><div className="table-wrap">{children}</div></section> }
function title(p) { return ({ attendance: 'Attendance', expenses: 'Expenses', activities: 'Activities', reports: 'Reports', forms: 'Forms' })[p] || 'Dashboard' }
function subtitle(p) { return ({ dashboard: 'A clear view of what is happening across your church.', attendance: 'Record and review service attendance.', expenses: 'Track church spending in one place.', activities: 'Keep church programs organized.', reports: 'Turn records into useful summaries.', forms: 'Structured forms for recurring church records.' })[p] }

function Modal({ title, children, close }) { return <div className="backdrop" onMouseDown={close}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Living Bells</span><h2>{title}</h2></div><button className="close" onClick={close}>×</button></div>{children}</div></div> }
function ActivityForm({ close, save }) {
  const [form, setForm] = useState({ name: '', type: 'Service', date: new Date().toISOString().slice(0, 10) })
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  return <Modal title="Record activity" close={close}>
    <label>Activity name<input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sunday Worship Service" /></label>
    <label>Type<select value={form.type} onChange={e => set('type', e.target.value)}>{['Service', 'Meeting', 'Outreach', 'Youth', 'Children', 'Choir', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Date<input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></label>
    <button className="primary wide" disabled={!form.name || !form.date} onClick={() => save(form)}>Save activity</button>
  </Modal>
}
function AttendanceForm({ close, save }) {
  const [service, setService] = useState('Sunday Service'), [date, setDate] = useState(new Date().toISOString().slice(0, 10)), [groups, setGroups] = useState(Object.fromEntries(['Children', 'Teenagers', 'Youth', 'Adults'].map(x => [x, { male: '', female: '' }])))
  const update = (g, s, v) => setGroups(x => ({ ...x, [g]: { ...x[g], [s]: v } })), total = Object.values(groups).reduce((a, g) => a + Number(g.male || 0) + Number(g.female || 0), 0)
  return <Modal title="Record attendance" close={close}><label>Service<input value={service} onChange={e => setService(e.target.value)} /></label><label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><div className="attendance-form"><div className="frow header"><span>Group</span><span>Male</span><span>Female</span></div>{Object.entries(groups).map(([g, v]) => <div className="frow" key={g}><b>{g}</b><input type="number" min="0" value={v.male} onChange={e => update(g, 'male', e.target.value)} placeholder="0" /><input type="number" min="0" value={v.female} onChange={e => update(g, 'female', e.target.value)} placeholder="0" /></div>)}</div><div className="total">Total attendance <b>{total}</b></div><button className="primary wide" onClick={() => save({ service, date, groups })} disabled={!service || !date}>Save attendance</button></Modal>
}
function ExpenseForm({ close, save }) {
  const [d, setD] = useState({ title: '', category: 'General', amount: '', date: new Date().toISOString().slice(0, 10) }), set = (k, v) => setD(x => ({ ...x, [k]: v }))
  return <Modal title="Record expense" close={close}><label>Description<input value={d.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Generator fuel" /></label><label>Category<select value={d.category} onChange={e => set('category', e.target.value)}>{['General', 'Utilities', 'Welfare', 'Choir', 'Evangelism', 'Media'].map(x => <option key={x}>{x}</option>)}</select></label><label>Amount<input type="number" min="0" value={d.amount} onChange={e => set('amount', e.target.value)} placeholder="0" /></label><label>Date<input type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label><button className="primary wide" disabled={!d.title || !d.amount} onClick={() => save(d)}>Save expense</button></Modal>
}
export default App

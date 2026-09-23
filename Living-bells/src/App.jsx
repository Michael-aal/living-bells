import { useEffect, useMemo, useState } from 'react'
import FinancePage from './FinancePage'
import ActivitiesPage from './ActivitiesPage'
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
  const [finances, setFinances] = useState([])
  const [activities, setActivities] = useState([])
  const [staff, setStaff] = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [reviews, setReviews] = useState([])
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState('Connecting...')
  const [query, setQuery] = useState('')

  const money = n => '₦' + Number(n || 0).toLocaleString('en-NG')
  const moneyIn = useMemo(() => finances.filter(item => item.type === 'INCOME').reduce((sum, item) => sum + Number(item.amount || 0), 0), [finances])
  const moneyOut = useMemo(() => finances.filter(item => item.type === 'EXPENSE').reduce((sum, item) => sum + Number(item.amount || 0), 0), [finances])
  const netMoney = moneyIn - moneyOut
  const totalSpend = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses])
  const normalizedQuery = query.trim().toLowerCase()
  const visibleAttendance = useMemo(() => !normalizedQuery ? attendance : attendance.filter(item => `${item.service} ${item.date}`.toLowerCase().includes(normalizedQuery)), [attendance, normalizedQuery])
  const visibleExpenses = useMemo(() => !normalizedQuery ? expenses : expenses.filter(item => `${item.title} ${item.category} ${item.date}`.toLowerCase().includes(normalizedQuery)), [expenses, normalizedQuery])
  const visibleFinances = useMemo(() => !normalizedQuery ? finances : finances.filter(item => `${item.type} ${item.category} ${item.description} ${item.date}`.toLowerCase().includes(normalizedQuery)), [finances, normalizedQuery])
  const visibleActivities = useMemo(() => !normalizedQuery ? activities : activities.filter(item => `${item.name} ${item.type || ''} ${formatDate(item.date)}`.toLowerCase().includes(normalizedQuery)), [activities, normalizedQuery])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    async function loadData() {
      setLoading(true)

      if (user.demo) {
        const demoAttendance = [
          { id: 'demo-attendance-1', service: 'Sunday Worship Service', date: '20 Sep 2026', total: 184, recordedBy: { id: 'demo-staff-1', name: 'John Doe', email: 'john@livingbells.demo' } },
          { id: 'demo-attendance-2', service: 'Youth Fellowship', date: '18 Sep 2026', total: 72, recordedBy: { id: 'demo-staff-2', name: 'Mary James', email: 'mary@livingbells.demo' } },
          { id: 'demo-attendance-3', service: 'Midweek Service', date: '16 Sep 2026', total: 126, recordedBy: { id: 'demo-staff-3', name: 'Peter Paul', email: 'peter@livingbells.demo' } },
        ]
        const demoFinances = [
          { id: 'demo-finance-1', type: 'INCOME', category: 'Offering', description: 'Sunday offering', amount: 245000, recordDate: '2026-09-20', date: '20 Sep 2026', recordedBy: { id: 'demo-staff-1', name: 'John Doe' } },
          { id: 'demo-finance-2', type: 'INCOME', category: 'Donation', description: 'Building donation', amount: 180000, recordDate: '2026-09-19', date: '19 Sep 2026', recordedBy: { id: 'demo-staff-2', name: 'Mary James' } },
          { id: 'demo-finance-3', type: 'EXPENSE', category: 'Utilities', description: 'Generator fuel', amount: 45000, recordDate: '2026-09-19', date: '19 Sep 2026', recordedBy: { id: 'demo-staff-1', name: 'John Doe' } },
          { id: 'demo-finance-4', type: 'EXPENSE', category: 'Choir', description: 'Choir materials', amount: 28000, recordDate: '2026-09-17', date: '17 Sep 2026', recordedBy: { id: 'demo-staff-2', name: 'Mary James' } },
        ]
        const demoExpenses = [
          { id: 'demo-expense-1', title: 'Generator fuel', category: 'Utilities', amount: 45000, date: '19 Sep 2026', recordedBy: { id: 'demo-staff-1', name: 'John Doe', email: 'john@livingbells.demo' } },
          { id: 'demo-expense-2', title: 'Choir materials', category: 'Choir', amount: 28000, date: '17 Sep 2026', recordedBy: { id: 'demo-staff-2', name: 'Mary James', email: 'mary@livingbells.demo' } },
          { id: 'demo-expense-3', title: 'Community outreach', category: 'Evangelism', amount: 65000, date: '14 Sep 2026', recordedBy: { id: 'demo-staff-3', name: 'Peter Paul', email: 'peter@livingbells.demo' } },
        ]
        const demoStaff = [
          { id: 'demo-staff-1', name: 'John Doe', email: 'john@livingbells.demo', role: 'STAFF', emailVerified: true, recordCount: 24, reviewCount: 3 },
          { id: 'demo-staff-2', name: 'Mary James', email: 'mary@livingbells.demo', role: 'STAFF', emailVerified: true, recordCount: 18, reviewCount: 3 },
          { id: 'demo-staff-3', name: 'Peter Paul', email: 'peter@livingbells.demo', role: 'STAFF', emailVerified: true, recordCount: 11, reviewCount: 2 },
        ]
        const demoActivities = [
          { id: 'demo-activity-1', name: 'Sunday Worship Service', type: 'Service', date: '2026-09-20', recordedBy: { id: 'demo-staff-1', name: 'John Doe' } },
          { id: 'demo-activity-2', name: 'Youth Fellowship', type: 'Youth', date: '2026-09-18', recordedBy: { id: 'demo-staff-2', name: 'Mary James' } },
          { id: 'demo-activity-3', name: 'Community Outreach', type: 'Outreach', date: '2026-09-14', recordedBy: { id: 'demo-staff-3', name: 'Peter Paul' } },
          { id: 'demo-activity-4', name: 'Choir Practice', type: 'Choir', date: '2026-09-12', recordedBy: { id: 'demo-staff-1', name: 'John Doe' } },
        ]

        setAttendance(demoAttendance)
        setExpenses(demoExpenses)
        setFinances(demoFinances)
        setActivities(demoActivities)
        setStaff(user.role === 'ADMIN' ? demoStaff : [])
        setReviews([])
        setSync('Demo mode')
        setLoading(false)
        return
      }

      setSync('Connecting...')
      try {
        const data = await api.dashboard()
        const staffData = user.role === 'ADMIN' ? await api.staff() : []
        if (cancelled) return
        setAttendance((data.attendance || []).map(normalizeAttendance))
        setExpenses((data.expenses || []).map(normalizeExpense))
        setFinances((data.finances || []).map(record => ({ ...record, amount: Number(record.amount || 0), date: formatDate(record.recordDate) })))
        setActivities(data.activities || [])
        setStaff(staffData)
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

  useEffect(() => {
    if (!user || user.role !== 'ADMIN' || !selectedStaff) return
    let cancelled = false
    async function loadReviews() {
      try {
        if (user.demo) {
          setReviews([])
          return
        }
        const data = await api.staffReviews(selectedStaff.id)
        if (!cancelled) setReviews(data || [])
      } catch (error) {
        if (!cancelled) setSync(error.message || 'Could not load staff reviews')
      }
    }
    loadReviews()
    return () => { cancelled = true }
  }, [user, selectedStaff])

  if (!user) return <Auth onAuthenticated={setUser} />

  function logout() {
    localStorage.removeItem('living_bells_token')
    localStorage.removeItem('living_bells_user')
    setUser(null)
    setAttendance([])
    setExpenses([])
    setFinances([])
    setActivities([])
    setStaff([])
    setSelectedStaff(null)
    setReviews([])
  }

  async function addAttendance(payload) {
    if (user.demo) {
      const total = Object.values(payload.groups || {}).reduce((sum, group) => sum + Number(group.male || 0) + Number(group.female || 0), 0)
      const demoRecord = {
        id: `demo-attendance-${Date.now()}`,
        service: payload.service,
        date: formatDate(payload.date),
        total,
      }
      setAttendance(current => [demoRecord, ...current])
      setModal(null)
      setSync('Demo mode')
      return
    }

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
    if (user.demo) {
      const demoRecord = { ...payload, id: `demo-activity-${Date.now()}` }
      setActivities(current => [demoRecord, ...current])
      setModal(null)
      setSync('Demo mode')
      return
    }

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
    if (user.demo) {
      const demoRecord = {
        id: `demo-expense-${Date.now()}`,
        title: payload.title,
        category: payload.category,
        amount: Number(payload.amount || 0),
        date: formatDate(payload.date),
      }
      setExpenses(current => [demoRecord, ...current])
      setModal(null)
      setSync('Demo mode')
      return
    }

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

  async function saveReview(payload) {
    if (!selectedStaff) return
    if (user.demo) {
      const review = { id: `demo-review-${Date.now()}`, staff: selectedStaff, admin: user, ...payload }
      setReviews(current => [review, ...current.filter(item => item.reviewDate !== payload.reviewDate)])
      setStaff(current => current.map(item => item.id === selectedStaff.id ? { ...item, reviewCount: (item.reviewCount || 0) + 1 } : item))
      setModal(null)
      setSync('Demo mode')
      return
    }
    try {
      setSync('Saving Sunday review...')
      const saved = await api.createStaffReview(selectedStaff.id, payload)
      setReviews(current => [saved, ...current.filter(item => item.reviewDate !== saved.reviewDate)])
      setStaff(current => current.map(item => item.id === selectedStaff.id ? { ...item, reviewCount: Math.max(item.reviewCount || 0, 1) } : item))
      setModal(null)
      setSync('Backend connected')
    } catch (error) {
      setSync(error.message || 'Could not save review')
    }
  }

  const isAdmin = user.role === 'ADMIN'
  const dashboardLabel = isAdmin ? 'Admin dashboard' : 'Staff dashboard'

  function printReport(titleText) {
    document.title = `Living Bells - ${titleText}`
    window.print()
    setTimeout(() => { document.title = 'Living Bells' }, 1000)
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo">L</div><div><b>Living Bells</b><small>{dashboardLabel}</small></div></div>
      <span className="label">Workspace</span>
      {[
        ['dashboard', '⌂', 'Dashboard'], ['attendance', '◉', 'Attendance'], ['expenses', '₦', 'Expenses'],
        ['activities', '▣', 'Activities'], ['programs', '◫', 'Programs'], ['finance', '₦', 'Finance'], ['reports', '⌁', 'Reports'], ...(isAdmin ? [['staff', '♙', 'Staff']] : []), ['forms', '□', 'Forms']
      ].map(([id, icon, name]) => <button key={id} className={page === id ? 'nav active' : 'nav'} onClick={() => setPage(id)}><i>{icon}</i>{name}</button>)}
      <div className="side-status"><span /> <div><b>{sync}</b><small>Authenticated API</small></div></div>
    </aside>

    <main>
      <header><div className="mobile-brand"><div className="logo">L</div>Living Bells</div><label className="search">⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records..." aria-label="Search records" /></label><button className="avatar" title="Sign out" onClick={logout}>{user.name?.slice(0, 2).toUpperCase() || 'ST'}</button></header>
      <section className="content">
        <div className="heading">
          <div><span className="eyebrow">{dashboardLabel}</span><h1>{page === 'dashboard' ? (isAdmin ? 'Admin dashboard 👋' : 'Staff dashboard 👋') : title(page)}</h1><p>{page === 'dashboard' ? (isAdmin ? 'Manage church operations, finances, activities and reports.' : 'Record and review the church activities assigned to your team.') : subtitle(page)}</p></div>
          <div className="actions"><button className="secondary" onClick={() => setPage('reports')}>View reports</button>{!isAdmin && <button className="primary" onClick={() => setModal('attendance')}>+ Record</button>}{isAdmin && <button className="secondary print-button" onClick={() => printReport('Church records')}>🖨 Print records</button>}</div>
        </div>

        {loading && <section className="card"><p>Loading your church records...</p></section>}
        {!loading && page === 'dashboard' && <Dashboard attendance={visibleAttendance} expenses={visibleExpenses} activitiesCount={activities.length} spend={totalSpend} money={money} moneyIn={moneyIn} moneyOut={moneyOut} netMoney={netMoney} open={setModal} go={setPage} isAdmin={isAdmin} />}
        {!loading && page === 'attendance' && <Records title="Service attendance" eyebrow="Attendance records" action="Record attendance" onAdd={() => setModal('attendance')} isAdmin={isAdmin} onPrint={() => printReport('Attendance report')}><table><thead><tr><th>Service</th><th>Date</th><th>Total people</th><th>Status</th>{isAdmin && <th>Recorded by</th>}</tr></thead><tbody>{visibleAttendance.map(r => <tr key={r.id}><td><b>{r.service}</b></td><td>{r.date}</td><td><b>{r.total}</b></td><td><span className="pill">Recorded</span></td>{isAdmin && <td>{r.recordedBy?.name || 'Unknown'}</td>}</tr>)}</tbody></table>{!attendance.length && <p>No attendance records yet.</p>}</Records>}
        {!loading && page === 'expenses' && <Records title="Expenses" eyebrow="Financial records" action="Record expense" onAdd={() => setModal('expense')} isAdmin={isAdmin} onPrint={() => printReport('Expense report')}><table><thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Amount</th>{isAdmin && <th>Recorded by</th>}</tr></thead><tbody>{visibleExpenses.map(r => <tr key={r.id}><td><b>{r.title}</b></td><td>{r.category}</td><td>{r.date}</td><td><b>{money(r.amount)}</b></td>{isAdmin && <td>{r.recordedBy?.name || 'Unknown'}</td>}</tr>)}</tbody></table>{!expenses.length && <p>No expenses recorded yet.</p>}</Records>}
        {!loading && page === 'programs' && <Records title="Programs" eyebrow="Church programs" action="Record activity" onAdd={() => setModal('activity')} isAdmin={isAdmin} onPrint={() => printReport('Activities report')}><table><thead><tr><th>Name</th><th>Type</th><th>Date</th>{isAdmin && <th>Recorded by</th>}</tr></thead><tbody>{visibleActivities.map(item => <tr key={item.id}><td><b>{item.name}</b></td><td>{item.type || '—'}</td><td>{formatDate(item.date)}</td>{isAdmin && <td>{item.recordedBy?.name || 'Unknown'}</td>}</tr>)}</tbody></table>{!activities.length && <p>No activities recorded yet.</p>}</Records>}
        {!loading && page === 'activities' && <ActivitiesPage user={user} />}
        {!loading && page === 'finance' && <FinancePage user={user} />}
        {!loading && page === 'staff' && isAdmin && <StaffPage staff={staff} selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} reviews={reviews} attendance={attendance} expenses={expenses} activities={activities} onReview={() => setModal('review')} onPrint={() => printReport(selectedStaff ? selectedStaff.name + ' Sunday reviews' : 'Staff report')} />}
        {!loading && page === 'reports' && <div className="report-grid"><Card title="Attendance"><strong className="big">{attendance.reduce((sum, item) => sum + item.total, 0).toLocaleString()}</strong><p>Combined recorded attendance.</p></Card><Card title="Expenses"><strong className="big">{money(totalSpend)}</strong><p>Combined expenses in this workspace.</p></Card></div>}
        {!loading && page === 'forms' && !isAdmin && <div className="form-grid"><Action icon="◉" title="Attendance form" text="Children, teenagers, youth, adults, men and women." onClick={() => setModal('attendance')} /><Action icon="₦" title="Expense form" text="Amount, category, description and date." onClick={() => setModal('expense')} /></div>}
        {!loading && page === 'forms' && isAdmin && <section className="card full"><span className="eyebrow">Admin view</span><h2>Staff recording forms</h2><p>Admins monitor records and print reports. Recording actions are reserved for staff accounts.</p></section>}
      </section>
    </main>

    {modal === 'activity' && <ActivityForm close={() => setModal(null)} save={addActivity} />}
    {modal === 'attendance' && <AttendanceForm close={() => setModal(null)} save={addAttendance} />}
    {modal === 'expense' && <ExpenseForm close={() => setModal(null)} save={addExpense} />}
    {modal === 'finance' && <FinanceForm close={() => setModal(null)} save={async payload => {
      if (user.demo) { setFinances(current => [{ id: `demo-finance-${Date.now()}`, ...payload, amount: Number(payload.amount), date: formatDate(payload.recordDate) }, ...current]); setModal(null); setSync('Demo mode'); return }
      try { setSync('Saving financial record...'); const saved = await api.createFinance(payload); setFinances(current => [{ ...saved, amount: Number(saved.amount), date: formatDate(saved.recordDate) }, ...current.filter(item => item.id !== saved.id)]); setModal(null); setSync('Backend connected') } catch (error) { setSync(error.message || 'Could not save financial record') }
    }} />}
    {modal === 'review' && selectedStaff && <ReviewForm staff={selectedStaff} close={() => setModal(null)} save={saveReview} />}
    <nav className="mobile-nav">{[['dashboard','⌂'],['attendance','◉'],['finance','₦'],['activities','▣'],['reports','⌁'],...(isAdmin ? [['staff','♙']] : [])].map(([id, icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><i>{icon}</i><span>{title(id)}</span></button>)}</nav>
  </div>
}

function Dashboard({ attendance, expenses, activitiesCount, spend, money, moneyIn, moneyOut, netMoney, open, go, isAdmin }) {
  return <>
    <div className="stats"><Stat icon="◉" name="Attendance" value={attendance[0]?.total || 0} note="Latest service" /><Stat icon="₦" name="Money in" value={money(moneyIn)} note="Income received" /><Stat icon="₦" name="Money out" value={money(moneyOut)} note="Expenses paid" /><Stat icon="⌁" name="Net" value={money(netMoney)} note="In minus out" /></div>
    <div className="quick">{!isAdmin && <><Action icon="◉" title="Record attendance" text="Capture children, teens, youth, adults and men and women." onClick={() => open('attendance')} /><Action icon="₦" title="Record money in or out" text="Record income received or expenses paid." onClick={() => open('finance')} /><Action icon="▣" title="Record activity" text="Plan a service, meeting, outreach or church program." onClick={() => open('activity')} /></>}{isAdmin && <Action icon="▤" title="Print reports" text="Print attendance, expense and activity tables." onClick={() => go('reports')} />}</div>
    <div className="dash-grid"><Card title="Attendance trend"><div className="bars">{attendance.slice(0, 7).reverse().map(r => <div className="bar-col" key={r.id}><b>{r.total}</b><div className="bar" style={{ height: Math.max(25, Math.min(100, r.total / 4)) + '%' }} /><small>{r.date.slice(0, 6)}</small></div>)}</div>{!attendance.length && <p>No attendance data yet.</p>}</Card><Card title="Recent spending"><div className="list">{expenses.slice(0, 5).map(e => <div className="row" key={e.id}><span className="mini">{e.title?.[0] || '₦'}</span><div><b>{e.title}</b><small>{e.category}</small></div><strong>{money(e.amount)}</strong></div>)}</div>{!expenses.length && <p>No expenses recorded yet.</p>}</Card></div>
  </>
}

function Stat({ icon, name, value, note }) { return <div className="stat"><span className="stat-icon">{icon}</span><div><small>{name}</small><strong>{value}</strong><em>{note}</em></div></div> }
function Action({ icon, title, text, onClick }) { return <button className="action-card" onClick={onClick}><span className="stat-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><strong>→</strong></button> }
function Card({ title, children }) { return <section className="card"><div className="card-head"><h2>{title}</h2></div>{children}</section> }
function Records({ title, eyebrow, action, onAdd, isAdmin, onPrint, children }) { return <section className="card full"><div className="card-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><div className="record-actions">{isAdmin && <button className="secondary print-button" onClick={onPrint}>🖨 Print table</button>}{!isAdmin && <button className="primary" onClick={onAdd}>{action}</button>}</div></div><div className="table-wrap">{children}</div></section> }
function title(p) { return ({ attendance: 'Attendance', finance: 'Finance', expenses: 'Expenses', activities: 'Activities', programs: 'Programs', reports: 'Reports', staff: 'Staff', forms: 'Forms' })[p] || 'Dashboard' }
function subtitle(p) { return ({ dashboard: 'A clear view of what is happening across your church.', attendance: 'Record and review service attendance.', finance: 'Track money in, money out and the net result.', expenses: 'Track church spending in one place.', activities: 'Complete the numerical and spiritual sections of the official weekly report.', programs: 'Keep church programs organized.', reports: 'Turn records into useful summaries.', staff: 'Review and support every staff member.', forms: 'Structured forms for recurring church records.' })[p] }


function StaffPage({ staff, selectedStaff, setSelectedStaff, reviews, attendance, expenses, activities, onReview, onPrint }) {
  const ratingLabel = value => ({ EXCELLENT: 'Excellent', GOOD: 'Good', FAIR: 'Fair', POOR: 'Poor', BAD: 'Bad' }[value] || value || '—')
  return <div className="staff-layout">
    <section className="card full">
      <div className="card-head"><div><span className="eyebrow">Administration</span><h2>Staff management</h2><p className="card-subtitle">Monitor staff activity and complete the Sunday review for each staff member.</p></div><button className="secondary print-button" onClick={onPrint}>🖨 Print</button></div>
      <div className="table-wrap"><table><thead><tr><th>Staff</th><th>Email</th><th>Status</th><th>Records</th><th>Reviews</th><th></th></tr></thead><tbody>{staff.map(item => <tr key={item.id} className={selectedStaff?.id === item.id ? 'selected-row' : ''}><td><b>{item.name}</b></td><td>{item.email}</td><td><span className="pill">{item.emailVerified ? 'Active' : 'Pending'}</span></td><td><b>{item.recordCount || 0}</b></td><td>{item.reviewCount || 0}</td><td><button className="secondary small-button" onClick={() => setSelectedStaff(item)}>Review</button></td></tr>)}</tbody></table>{!staff.length && <p>No staff members found.</p>}</div>
    </section>
    {selectedStaff && <section className="card full">
      <div className="card-head"><div><span className="eyebrow">Sunday review</span><h2>{selectedStaff.name}</h2><p className="card-subtitle">{selectedStaff.email} · {selectedStaff.recordCount || 0} operational records</p></div><button className="primary" onClick={onReview}>+ Sunday review</button></div>
      <div className="staff-record-summary">
        <span className="eyebrow">Record activity</span>
        <h3>Recent records</h3>
        <div className="table-wrap"><table><thead><tr><th>Type</th><th>Record</th><th>Date</th><th>Recorded by</th></tr></thead><tbody>{[
          ...attendance.filter(r => r.recordedBy?.id === selectedStaff.id || r.recordedBy?.name === selectedStaff.name).slice(0, 4).map(r => ({ type: 'Attendance', name: r.service, date: r.date })),
          ...expenses.filter(r => r.recordedBy?.id === selectedStaff.id || r.recordedBy?.name === selectedStaff.name).slice(0, 4).map(r => ({ type: 'Expense', name: r.title, date: r.date })),
          ...activities.filter(r => r.recordedBy?.id === selectedStaff.id || r.recordedBy?.name === selectedStaff.name).slice(0, 4).map(r => ({ type: 'Activity', name: r.name, date: formatDate(r.date) })),
        ].slice(0, 8).map((r, index) => <tr key={index}><td>{r.type}</td><td><b>{r.name}</b></td><td>{r.date}</td><td>{selectedStaff.name}</td></tr>)}</tbody></table></div>
      </div>
      <div className="review-history">{reviews.map(review => <div className="review-card" key={review.id}><div><b>{formatDate(review.reviewDate)}</b><span className={`review-rating rating-${String(review.rating || '').toLowerCase()}`}>{ratingLabel(review.rating)}</span></div><p>{review.comment || 'No comment added.'}</p><small>Reviewed by {review.admin?.name || 'Admin'}</small></div>)}{!reviews.length && <p>No Sunday review has been recorded for this staff member yet.</p>}</div>
    </section>}
  </div>
}

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
function ReviewForm({ staff, close, save }) {
  const today = new Date()
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay())
  const [form, setForm] = useState({ reviewDate: sunday.toISOString().slice(0, 10), rating: 'GOOD', comment: '' })
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const isSunday = new Date(`${form.reviewDate}T00:00:00`).getDay() === 0
  return <Modal title={`Sunday review · ${staff.name}`} close={close}>
    <p className="review-intro">Give this staff member a Sunday review based on their records, consistency and assigned responsibilities.</p>
    <label>Sunday date<input type="date" value={form.reviewDate} onChange={e => set('reviewDate', e.target.value)} /></label>
    <label>Overall rating<select value={form.rating} onChange={e => set('rating', e.target.value)}>{['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'BAD'].map(x => <option key={x} value={x}>{x[0] + x.slice(1).toLowerCase()}</option>)}</select></label>
    <label>Admin comment<textarea value={form.comment} onChange={e => set('comment', e.target.value)} placeholder="Add a short review..." rows="4" /></label>
    <button className="primary wide" disabled={!form.reviewDate || !isSunday} onClick={() => save(form)}>Save Sunday review</button>{!isSunday && <small className="form-error">Choose a Sunday date for the weekly review.</small>}
  </Modal>
}

function FinanceForm({ close, save }) {
  const [form, setForm] = useState({ type: 'INCOME', category: '', amount: '', description: '', recordDate: new Date().toISOString().slice(0, 10) })
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  return <Modal title={form.type === 'INCOME' ? 'Record money in' : 'Record money out'} close={close}><label>Type<select value={form.type} onChange={e => set('type', e.target.value)}><option value="INCOME">Money in</option><option value="EXPENSE">Money out</option></select></label><label>Category<input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Offering" /></label><label>Description<input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description" /></label><label>Amount<input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" /></label><label>Date<input type="date" value={form.recordDate} onChange={e => set('recordDate', e.target.value)} /></label><button className="primary wide" disabled={!form.category || !form.amount || Number(form.amount) <= 0} onClick={() => save(form)}>Save transaction</button></Modal>
}


function ExpenseForm({ close, save }) {
  const [d, setD] = useState({ title: '', category: 'General', amount: '', date: new Date().toISOString().slice(0, 10) }), set = (k, v) => setD(x => ({ ...x, [k]: v }))
  return <Modal title="Record expense" close={close}><label>Description<input value={d.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Generator fuel" /></label><label>Category<select value={d.category} onChange={e => set('category', e.target.value)}>{['General', 'Utilities', 'Welfare', 'Choir', 'Evangelism', 'Media'].map(x => <option key={x}>{x}</option>)}</select></label><label>Amount<input type="number" min="0" value={d.amount} onChange={e => set('amount', e.target.value)} placeholder="0" /></label><label>Date<input type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label><button className="primary wide" disabled={!d.title || !d.amount} onClick={() => save(d)}>Save expense</button></Modal>
}
export default App

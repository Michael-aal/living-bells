import { useEffect, useMemo, useState } from 'react'
import FinancePage from './FinancePage'
import ActivitiesPage from './ActivitiesPage'
import ReportsPage from './ReportsPage'
import ReportingCalendar from './ReportingCalendar'
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
  const [reportEditDate, setReportEditDate] = useState(null)
  const [reportRefresh, setReportRefresh] = useState(0)
  const [attendance, setAttendance] = useState([])
  const [expenses, setExpenses] = useState([])
  const [finances, setFinances] = useState([])
  const [weeklyReports, setWeeklyReports] = useState([])
  const [activities, setActivities] = useState([])
  const [staff, setStaff] = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [reviews, setReviews] = useState([])
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState('Connecting...')
  const [query, setQuery] = useState('')
  const [reportingContext, setReportingContext] = useState(null)

  const money = n => '₦' + Number(n || 0).toLocaleString('en-NG')
  const moneyIn = useMemo(() => weeklyReports.reduce((sum, report) => sum + Number(report.totalIncome || 0), 0), [weeklyReports])
  const moneyOut = useMemo(() => weeklyReports.reduce((sum, report) => sum + Number(report.totalExpenditure || 0), 0), [weeklyReports])
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayMoneyIn = useMemo(() => weeklyReports.filter(report => String(report.reportDate).slice(0, 10) === todayKey).reduce((sum, report) => sum + Number(report.totalIncome || 0), 0), [weeklyReports, todayKey])
  const todayMoneyOut = useMemo(() => weeklyReports.filter(report => String(report.reportDate).slice(0, 10) === todayKey).reduce((sum, report) => sum + Number(report.totalExpenditure || 0), 0), [weeklyReports, todayKey])
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
        setReportingContext(null)
        setSync('Demo mode')
        setLoading(false)
        return
      }

      setSync('Connecting...')
      try {
        const [data, weeklyData, currentReporting] = await Promise.all([api.dashboard(), api.weeklyReports(), api.reportingCurrent()])
        const staffData = user.role === 'ADMIN' ? await api.staff() : []
        if (cancelled) return
        setAttendance((data.attendance || []).map(normalizeAttendance))
        setExpenses((data.expenses || []).map(normalizeExpense))
        setFinances((data.finances || []).map(record => ({ ...record, amount: Number(record.amount || 0), date: formatDate(record.recordDate) })))
        setWeeklyReports(weeklyData || [])
        setReportingContext(currentReporting || null)
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
    setWeeklyReports([])
    setActivities([])
    setStaff([])
    setSelectedStaff(null)
    setReviews([])
  }

  async function saveProfile(name) {
    const nextName = String(name || '').trim()
    if (nextName.length < 2) {
      setSync('Username must be at least 2 characters')
      return
    }

    if (user.demo) {
      const updated = { ...user, name: nextName }
      localStorage.setItem('living_bells_user', JSON.stringify(updated))
      setUser(updated)
      setModal(null)
      setSync('Demo mode')
      return
    }

    try {
      setSync('Saving username...')
      const updated = await api.updateProfile({ name: nextName })
      localStorage.setItem('living_bells_user', JSON.stringify(updated))
      setUser(updated)
      setModal(null)
      setSync('Backend connected')
    } catch (error) {
      setSync(error.message || 'Could not save username')
    }
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
      return true
    }

    try {
      setSync('Saving attendance...')
      const saved = await api.createAttendance(payload)
      setAttendance(current => [normalizeAttendance(saved), ...current.filter(item => item.id !== saved.id)])
      setReportRefresh(value => value + 1)
      setModal(null)
      setSync('Backend connected')
      return true
    } catch (error) {
      setSync(error.message || 'Could not save attendance')
      return false
    }
  }

  async function saveAttendanceEdit(payload) {
    return addAttendance(payload)
  }

  async function addActivity(payload) {
    if (user.demo) {
      const demoRecord = { ...payload, id: `demo-activity-${Date.now()}` }
      setActivities(current => [demoRecord, ...current])
      setModal(null)
      setSync('Demo mode')
      return true
    }

    try {
      setSync('Saving activity...')
      const saved = await api.createActivity(payload)
      setActivities(current => [saved, ...current.filter(item => item.id !== saved.id)])
      setReportRefresh(value => value + 1)
      setModal(null)
      setSync('Backend connected')
      return true
    } catch (error) {
      setSync(error.message || 'Could not save activity')
      return false
    }
  }

  async function updateActivity(payload) {
    if (!payload?.id) return addActivity(payload)
    if (user.demo) {
      setActivities(current => current.map(item => item.id === payload.id ? { ...item, ...payload } : item))
      setModal(null)
      setSync('Demo mode')
      return true
    }
    try {
      setSync('Saving activity changes...')
      const saved = await api.updateActivity(payload.id, payload)
      setActivities(current => [saved, ...current.filter(item => item.id !== saved.id)])
      setModal(null)
      setSync('Backend connected')
      return true
    } catch (error) {
      setSync(error.message || 'Could not update activity')
      return false
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
      return true
    }

    try {
      setSync('Saving expense...')
      const saved = await api.createExpense(payload)
      setExpenses(current => [normalizeExpense(saved), ...current.filter(item => item.id !== saved.id)])
      setModal(null)
      setSync('Backend connected')
      return true
    } catch (error) {
      setSync(error.message || 'Could not save expense')
      return false
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

  function openReportEditor(date) {
    setReportEditDate(date)
    setPage('activities')
  }

  function openFinanceEditor(date) {
    setReportEditDate(date)
    setPage('finance')
  }

  function openActivityEditor(record) {
    setModal({ type: 'activity-edit', record })
  }

  function openAttendanceEditor(record) {
    setModal({ type: 'attendance-edit', record })
  }

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
        ['dashboard', 'Dashboard'], ['attendance', 'Attendance'],
        ['activities', 'Activities'], ['finance', 'Finance'], ['reports', 'Reports'], ['reporting', 'Reporting'], ...(isAdmin ? [['staff', 'Staff']] : [])
      ].map(([id, icon, name]) => <button key={id} className={page === id ? 'nav active' : 'nav'} onClick={() => setPage(id)}>{name}</button>)}
      <div className="side-status"><span /> <div><b>{sync}</b><small>Authenticated API</small></div></div>
    </aside>

    <main>
      <header><div className="mobile-brand"><div className="logo">L</div>Living Bells</div><label className="search">⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records..." aria-label="Search records" /></label><button className="avatar" title="Edit username" onClick={() => setModal('profile')}>{user.name?.slice(0, 2).toUpperCase() || 'ST'}</button></header>
      <section className="content">
        <div className="heading">
          <div><span className="eyebrow">{dashboardLabel}</span><h1>{page === 'dashboard' ? (isAdmin ? 'Admin dashboard' : 'Staff dashboard') : title(page)}</h1><p>{page === 'dashboard' ? (isAdmin ? 'Manage church operations, finances, activities and reports.' : 'Record and review the church activities assigned to your team.') : subtitle(page)}</p></div>
          <div className="actions"><button type="button" className="secondary" onClick={() => setPage('reports')}>View reports</button>{isAdmin && <button type="button" className="secondary print-button" onClick={() => printReport('Church records')}>🖨 Print records</button>}</div>
        </div>

        {loading && <section className="card"><p>Loading your church records...</p></section>}
        {!loading && page === 'dashboard' && <Dashboard user={user} reportingContext={reportingContext} attendance={visibleAttendance} expenses={visibleExpenses} activitiesCount={activities.length} spend={totalSpend} money={money} moneyIn={moneyIn} moneyOut={moneyOut} todayMoneyIn={todayMoneyIn} todayMoneyOut={todayMoneyOut} netMoney={netMoney} open={setModal} go={setPage} isAdmin={isAdmin} />}
        {!loading && page === 'attendance' && <Records title="Service attendance" eyebrow="Attendance records" action="Record attendance" onAdd={() => setModal('attendance')} isAdmin={isAdmin} onPrint={() => printReport('Attendance report')}><table><thead><tr><th>Service</th><th>Date</th><th>Total people</th><th>Status</th>{isAdmin && <th>Recorded by</th>}</tr></thead><tbody>{visibleAttendance.map(r => <tr key={r.id}><td><b>{r.service}</b></td><td>{r.date}</td><td><b>{r.total}</b></td><td><span className="pill">Recorded</span></td>{isAdmin && <td>{r.recordedBy?.name || 'Unknown'}</td>}</tr>)}</tbody></table>{!attendance.length && <p>No attendance records yet.</p>}</Records>}
        {!loading && page === 'activities' && <ActivitiesPage user={user} initialDate={reportEditDate} onInitialDateHandled={() => setReportEditDate(null)} />}
        {!loading && page === 'finance' && <FinancePage user={user} />}
        {!loading && page === 'staff' && isAdmin && <StaffPage staff={staff} selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} reviews={reviews} attendance={attendance} expenses={expenses} activities={activities} onReview={() => setModal('review')} onPrint={() => printReport(selectedStaff ? selectedStaff.name + ' Sunday reviews' : 'Staff report')} />}
        {!loading && page === 'reporting' && <ReportingCalendar user={user} current={reportingContext} />}
        {!loading && page === 'reports' && <ReportsPage refreshKey={reportRefresh} user={user} onEdit={openReportEditor} onEditFinance={openFinanceEditor} onEditActivity={openActivityEditor} onEditAttendance={openAttendanceEditor} />}
        
      </section>
    </main>

    {modal === 'profile' && <ProfileForm user={user} close={() => setModal(null)} save={saveProfile} />}
    {modal === 'attendance' && <AttendanceForm close={() => setModal(null)} save={addAttendance} />}
    {modal?.type === 'attendance-edit' && <AttendanceForm initial={modal.record} close={() => setModal(null)} save={saveAttendanceEdit} />}
    {modal === 'finance' && <FinanceForm close={() => setModal(null)} save={async payload => {
      if (user.demo) {
        setFinances(current => [{ id: `demo-finance-${Date.now()}`, ...payload, amount: Number(payload.amount), date: formatDate(payload.recordDate) }, ...current])
        setModal(null)
        setSync('Demo mode')
        return true
      }
      try {
        setSync('Saving financial record...')
        const saved = await api.createFinance(payload)
        setFinances(current => [{ ...saved, amount: Number(saved.amount), date: formatDate(saved.recordDate) }, ...current.filter(item => item.id !== saved.id)])
        setModal(null)
        setSync('Backend connected')
        return true
      } catch (error) {
        setSync(error.message || 'Could not save financial record')
        return false
      }
    }} />}
    {modal === 'review' && selectedStaff && <ReviewForm staff={selectedStaff} close={() => setModal(null)} save={saveReview} />}
    {modal?.type === 'activity-edit' && <ActivityForm initial={modal.record} close={() => setModal(null)} save={updateActivity} />}
    <nav className="mobile-nav">{[['dashboard','⌂'],['attendance','◉'],['finance','₦'],['activities','▣'],['reports','⌁'],...(isAdmin ? [['staff','♙']] : [])].map(([id, icon]) => <button type="button" key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><i>{icon}</i><span>{title(id)}</span></button>)}</nav>
  </div>
}

function Dashboard({ user, reportingContext, attendance, expenses, activitiesCount, spend, money, moneyIn, moneyOut, todayMoneyIn, todayMoneyOut, netMoney, open, go, isAdmin }) {
  const now = new Date()
  const today = now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const monthLabel = reportingContext?.month ? new Date(Date.UTC(2026, Number(reportingContext.month.month) - 1, 1)).toLocaleDateString('en-NG', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null
  return <>
    <section className="welcome-card">
      <span className="eyebrow">Living Bells</span>
      <h2>Good day, {user?.name || 'there'}</h2>
      <p className="welcome-date">{today}</p>
      <h3>What would you like to record?</h3>
      <div className="welcome-actions">
        <button type="button" onClick={() => go('attendance')}>Attendance</button>
        <button type="button" onClick={() => go('finance')}>Finance</button>
        <button type="button" onClick={() => go('activities')}>Activities</button>
      </div>
      {reportingContext?.week ? <p className="reporting-context"><b>{monthLabel} · Week {reportingContext.week.weekNumber}</b><span>{reportingContext.day} · {reportingContext.date}</span></p> : <p className="reporting-context"><b>Reporting week not configured</b><span>An administrator needs to assign today's date to a seven-day reporting week.</span></p>}
    </section>
    <div className="stats"><Stat icon="◉" name="Attendance" value={attendance[0]?.total || 0} note="Latest service" /><Stat icon="₦" name="Total money in" value={money(moneyIn)} note="All saved weekly reports" /><Stat icon="₦" name="Total money out" value={money(moneyOut)} note="All saved weekly reports" /><Stat icon="⌁" name="Total balance" value={money(netMoney)} note="Total in minus total out" /></div>
    <section className="card dashboard-today"><div><span className="eyebrow">Today</span><h2>Today's finance snapshot</h2><p className="card-subtitle">Only records saved for today's date.</p></div><div className="today-money"><div><small>Money in</small><b>{money(todayMoneyIn)}</b></div><div><small>Money out</small><b>{money(todayMoneyOut)}</b></div><div><small>Balance</small><b>{money(todayMoneyIn - todayMoneyOut)}</b></div></div></section>
    <div className="quick">{!isAdmin && <><Action icon="₦" title="Record money in or out" text="Record income received or expenses paid." onClick={() => go('finance')} /><Action icon="▣" title="Record activity" text="Plan a service, meeting, outreach or church program." onClick={() => open('activity')} /></>}{isAdmin && <Action icon="▤" title="Print reports" text="Print attendance, expense and activity tables." onClick={() => go('reports')} />}</div>
    <div className="dash-grid"><Card title="Attendance trend"><div className="bars">{attendance.slice(0, 7).reverse().map(r => <div className="bar-col" key={r.id}><b>{r.total}</b><div className="bar" style={{ height: Math.max(25, Math.min(100, r.total / 4)) + '%' }} /><small>{r.date.slice(0, 6)}</small></div>)}</div>{!attendance.length && <p>No attendance data yet.</p>}</Card><Card title="Recent spending"><div className="list">{expenses.slice(0, 5).map(e => <div className="row" key={e.id}><span className="mini">{e.title?.[0] || '₦'}</span><div><b>{e.title}</b><small>{e.category}</small></div><strong>{money(e.amount)}</strong></div>)}</div>{!expenses.length && <p>No expenses recorded yet.</p>}</Card></div>
  </>
}

function Stat({ icon, name, value, note }) { return <div className="stat"><span className="stat-icon">{icon}</span><div><small>{name}</small><strong>{value}</strong><em>{note}</em></div></div> }
function Action({ icon, title, text, onClick }) { return <button type="button" className="action-card" onClick={onClick}><span className="stat-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><strong>→</strong></button> }
function Card({ title, children }) { return <section className="card"><div className="card-head"><h2>{title}</h2></div>{children}</section> }
function Records({ title, eyebrow, action, onAdd, isAdmin, onPrint, children }) { return <section className="card full"><div className="card-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><div className="record-actions">{isAdmin && <button type="button" className="secondary print-button" onClick={onPrint}>🖨 Print table</button>}{!isAdmin && <button type="button" className="primary" onClick={onAdd}>{action}</button>}</div></div><div className="table-wrap">{children}</div></section> }
function title(p) { return ({ attendance: 'Attendance', finance: 'Finance', activities: 'Activities', reports: 'Reports', reporting: 'Reporting Calendar', staff: 'Staff' })[p] || 'Dashboard' }
function subtitle(p) { return ({ dashboard: 'A clear view of what is happening across your church.', attendance: 'Record and review service attendance.', finance: 'Track money in, money out and the net result.', activities: 'Complete the numerical and spiritual sections of the official weekly report.', reports: 'Turn records into useful summaries.', staff: 'Review and support every staff member.',  })[p] }


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

function Modal({ title, children, close }) { return <div className="backdrop" onMouseDown={close}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Living Bells</span><h2>{title}</h2></div><button type="button" className="close" onClick={close}>×</button></div>{children}</div></div> }
function ProfileForm({ user, close, save }) {
  const [name, setName] = useState(user.name || '')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const value = name.trim()
    if (value.length < 2) return
    setSaving(true)
    try { await save(value) } finally { setSaving(false) }
  }

  return <Modal title="Profile" close={close}>
    <p className="review-intro">Update the username shown across Living Bells.</p>
    <label>Username<input autoFocus maxLength="80" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label>
    <label>Email<input value={user.email || ''} readOnly /></label>
    <button className="primary wide" disabled={saving || name.trim().length < 2 || name.trim() === (user.name || '').trim()} onClick={submit}>{saving ? 'Saving…' : 'Save username'}</button>
  </Modal>
}
function ActivityForm({ close, save, initial = null }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id,
    name: initial?.name || '',
    type: initial?.type || 'Service',
    date: String(initial?.date || new Date().toISOString()).slice(0, 10),
  }))
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  async function submit() {
    if (saving || !form.name || !form.date) return
    setSaving(true)
    const success = await save(form)
    if (!success) setSaving(false)
  }

  return <Modal title={initial ? 'Edit activity' : 'Submit activity'} close={close}>
    <label>Activity name<input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sunday Worship Service" /></label>
    <label>Type<select value={form.type} onChange={e => set('type', e.target.value)}>{['Service', 'Meeting', 'Outreach', 'Youth', 'Children', 'Choir', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Date<input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></label>
    <button type="button" className="primary wide" disabled={saving || !form.name || !form.date} onClick={submit}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Submit activity'}</button>
  </Modal>
}
function AttendanceForm({ close, save, initial = null }) {
  const activity = initial?.activity || {}
  const [service, setService] = useState(initial?.service || activity.name || 'Sunday Service')
  const [date, setDate] = useState(String(initial?.dateRaw || activity.date || new Date().toISOString()).slice(0, 10))
  const [groups, setGroups] = useState(() => ({
    Children: { male: initial?.childrenMale ?? '', female: initial?.childrenFemale ?? '' },
    Teenagers: { male: initial?.teenagersMale ?? '', female: initial?.teenagersFemale ?? '' },
    Youth: { male: initial?.youthMale ?? '', female: initial?.youthFemale ?? '' },
    Adults: { male: initial?.adultsMale ?? '', female: initial?.adultsFemale ?? '' },
  }))
  const [saving, setSaving] = useState(false)
  const update = (g, s, v) => setGroups(x => ({ ...x, [g]: { ...x[g], [s]: v } }))
  const total = Object.values(groups).reduce((a, g) => a + Number(g.male || 0) + Number(g.female || 0), 0)

  async function submit() {
    if (saving || !service || !date) return
    setSaving(true)
    const success = await save({ activityId: initial?.activityId || initial?.activity?.id, service, date, groups })
    if (!success) setSaving(false)
  }

  return <Modal title={initial ? 'Edit attendance' : 'Record attendance'} close={close}>
    <label>Service<input value={service} onChange={e => setService(e.target.value)} /></label>
    <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <div className="attendance-form"><div className="frow header"><span>Group</span><span>Male</span><span>Female</span></div>{Object.entries(groups).map(([g, v]) => <div className="frow" key={g}><b>{g}</b><input type="number" min="0" value={v.male} onChange={e => update(g, 'male', e.target.value)} placeholder="0" /><input type="number" min="0" value={v.female} onChange={e => update(g, 'female', e.target.value)} placeholder="0" /></div>)}</div>
    <div className="total">Total attendance <b>{total}</b></div>
    <button type="button" className="primary wide" onClick={submit} disabled={saving || !service || !date}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Save attendance'}</button>
  </Modal>
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
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  async function submit() {
    if (saving || !form.category || !form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    const success = await save(form)
    if (!success) setSaving(false)
  }

  return <Modal title={form.type === 'INCOME' ? 'Submit money in' : 'Submit money out'} close={close}><label>Type<select value={form.type} onChange={e => set('type', e.target.value)}><option value="INCOME">Money in</option><option value="EXPENSE">Money out</option></select></label><label>Category<input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Offering" /></label><label>Description<input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description" /></label><label>Amount<input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" /></label><label>Date<input type="date" value={form.recordDate} onChange={e => set('recordDate', e.target.value)} /></label><button type="button" className="primary wide" disabled={saving || !form.category || !form.amount || Number(form.amount) <= 0} onClick={submit}>{saving ? 'Saving…' : 'Submit transaction'}</button></Modal>
}


function ExpenseForm({ close, save }) {
  const [d, setD] = useState({ title: '', category: 'General', amount: '', date: new Date().toISOString().slice(0, 10) }), [saving, setSaving] = useState(false), set = (k, v) => setD(x => ({ ...x, [k]: v }))

  async function submit() {
    if (saving || !d.title || !d.amount) return
    setSaving(true)
    const success = await save(d)
    if (!success) setSaving(false)
  }

  return <Modal title="Submit expense" close={close}><label>Description<input value={d.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Generator fuel" /></label><label>Category<select value={d.category} onChange={e => set('category', e.target.value)}>{['General', 'Utilities', 'Welfare', 'Choir', 'Evangelism', 'Media'].map(x => <option key={x}>{x}</option>)}</select></label><label>Amount<input type="number" min="0" value={d.amount} onChange={e => set('amount', e.target.value)} placeholder="0" /></label><label>Date<input type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label><button type="button" className="primary wide" disabled={saving || !d.title || !d.amount} onClick={submit}>{saving ? 'Saving…' : 'Submit expense'}</button></Modal>
}
export default App

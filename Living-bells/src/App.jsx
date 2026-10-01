import { useEffect, useMemo, useState } from 'react'
import FinancePage from './FinancePage'
import ActivitiesPage from './ActivitiesPage'
import ReportsPage from './ReportsPage'
import ReportingCalendar from './ReportingCalendar'
import './App.css'
import Auth from './Auth'
import { api, syncOfflineQueue } from './api'
import { queueCount } from './offlineStore'

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

function dateKey(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function periodRange(duration, reference = new Date()) {
  const current = new Date(reference)
  const year = current.getUTCFullYear()
  const month = current.getUTCMonth()
  const day = current.getUTCDate()

  if (duration === 'yearly') {
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
    }
  }

  if (duration === 'monthly') {
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    }
  }

  const currentDay = new Date(Date.UTC(year, month, day))
  const dayOfWeek = currentDay.getUTCDay()
  const start = new Date(currentDay)
  start.setUTCDate(currentDay.getUTCDate() - dayOfWeek)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 7)
  return { start, end }
}

function inPeriod(value, range) {
  const key = dateKey(value)
  if (!key) return false
  const date = new Date(key + 'T00:00:00Z')
  return date >= range.start && date < range.end
}

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('living_bells_user') || 'null') } catch { return null }
  })
  const [page, setPage] = useState('dashboard')
  const [reportEditDate, setReportEditDate] = useState(null)
  const [reportRefresh, setReportRefresh] = useState(0)
  const [attendance, setAttendance] = useState([])
  const [attendanceOptions, setAttendanceOptions] = useState([])
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
  const [staffInvitations, setStaffInvitations] = useState([])
  const [staffCount, setStaffCount] = useState({ active: 0, pending: 0, total: 0 })
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  useEffect(() => {
    if (!user || user.demo) return
    let mounted = true
    const refresh = async () => {
      if (navigator.onLine) await syncOfflineQueue().catch(() => {})
      const pending = await queueCount().catch(() => 0)
      if (!mounted) return
      setSync(navigator.onLine ? (pending ? `Sync pending: ${pending}` : 'Backend connected') : (pending ? `Offline · ${pending} pending` : 'Offline · saved on device'))
    }
    const onOnline = () => refresh()
    const onOffline = () => refresh()
    const onSync = () => refresh()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('living-bells-sync', onSync)
    refresh()
    return () => { mounted = false; window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('living-bells-sync', onSync) }
  }, [user])
  const mobileNavRef = useState(() => ({ current: null }))[0]

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
        const [data, weeklyData, currentReporting, attendanceOptionData] = await Promise.all([api.dashboard(), api.weeklyReports(), api.reportingCurrent(), api.options('ATTENDANCE')])
        const staffData = user.role === 'ADMIN' ? await api.staff() : []
        const invitationData = user.role === 'ADMIN' ? await api.staffInvitations() : []
        const countData = user.role === 'ADMIN' ? await api.staffCount() : { active: 0, pending: 0, total: 0 }
        if (cancelled) return
        setAttendance((data.attendance || []).map(normalizeAttendance))
        setAttendanceOptions(attendanceOptionData || [])
        setExpenses((data.expenses || []).map(normalizeExpense))
        setFinances((data.finances || []).map(record => ({ ...record, amount: Number(record.amount || 0), date: formatDate(record.recordDate) })))
        setWeeklyReports(weeklyData || [])
        setReportingContext(currentReporting || null)
        setActivities(data.activities || [])
        setStaff(staffData)
        setStaffInvitations(invitationData || [])
        setStaffCount(countData || { active: 0, pending: 0, total: 0 })
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
    localStorage.removeItem('living_bells_offline_session')
    localStorage.removeItem('living_bells_user')
    setUser(null)
    setAttendance([])
    setAttendanceOptions([])
    setExpenses([])
    setFinances([])
    setWeeklyReports([])
    setActivities([])
    setStaff([])
    setStaffInvitations([])
    setStaffCount({ active: 0, pending: 0, total: 0 })
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

  async function deleteAttendanceRecord(id) { if(!id||!window.confirm('Delete this attendance record? This cannot be undone.')) return; try { await api.deleteAttendance(id); setAttendance(current=>current.filter(r=>r.id!==id)); setSync('Backend connected'); } catch(error){setSync(error.message||'Could not delete attendance record')} }

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

  async function toggleStaffStatus(member) {
    if (!member || user.demo) {
      if (user.demo) setStaff(current => current.map(item => item.id === member.id ? { ...item, isActive: !item.isActive } : item))
      return
    }
    const next = !member.isActive
    if (!window.confirm(`${next ? 'Activate' : 'Deactivate'} ${member.name}'s account?`)) return
    try {
      const updated = await api.updateStaffStatus(member.id, next)
      setStaff(current => current.map(item => item.id === member.id ? { ...item, ...updated } : item))
      setSelectedStaff(current => current?.id === member.id ? { ...current, ...updated } : current)
      setSync('Backend connected')
    } catch (error) { setSync(error.message || 'Could not update staff status') }
  }

  async function deleteStaff(member) {
    if (!member) return
    if (!window.confirm(`Permanently delete ${member.name}'s account? Historical attendance, finance and activity records will be preserved, but the account itself cannot be recovered.`)) return
    if (user.demo) {
      setStaff(current => current.filter(item => item.id !== member.id)); setSelectedStaff(null); return
    }
    try {
      await api.deleteStaff(member.id)
      setStaff(current => current.filter(item => item.id !== member.id))
      setSelectedStaff(null)
      setStaffCount(current => ({ ...current, active: Math.max(0, current.active - (member.isActive ? 1 : 0)), total: Math.max(0, current.total - 1) }))
      setSync('Backend connected')
    } catch (error) { setSync(error.message || 'Could not delete staff account') }
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
        ['activities', 'Activities'], ['finance', 'Finance'], ['reports', 'Reports'], ['calendar', 'Calendar'], ...(isAdmin ? [['staff', 'Staff']] : []), ['settings', 'Settings']
      ].map(([id, name]) => <button key={id} className={page === id ? 'nav active' : 'nav'} onClick={() => setPage(id)}>{name}</button>)}
      <div className="side-status"><span /> <div><b>{sync}</b><small>Authenticated API</small></div></div>
    </aside>

    <main>
      <header><div className="mobile-brand"><div className="logo">L</div>Living Bells</div><label className="search">⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records..." aria-label="Search records" /></label><div className="profile-menu"><button className="avatar" title="Open profile menu" onClick={() => setModal(modal === 'profile-menu' ? null : 'profile-menu')} aria-haspopup="menu" aria-expanded={modal === 'profile-menu'}>{user.name?.slice(0, 2).toUpperCase() || 'ST'}</button>{modal === 'profile-menu' && <div className="profile-dropdown" role="menu"><div className="profile-summary"><strong>{user.name || 'User'}</strong><span>{user.email}</span><small>{user.role === 'ADMIN' ? 'Administrator' : 'Staff'}</small></div><button type="button" role="menuitem" onClick={() => setModal('profile')}>Edit profile</button><button type="button" role="menuitem" onClick={() => { setModal(null); setPage('settings') }}>Settings</button><button type="button" role="menuitem" className="profile-logout" onClick={() => { setModal(null); logout() }}>Log out</button></div>}</div></header>
      <section className="content">
        <div className="heading">
          <div><span className="eyebrow">{dashboardLabel}</span><h1>{page === 'dashboard' ? (isAdmin ? 'Admin dashboard' : 'Staff dashboard') : title(page)}</h1><p>{page === 'dashboard' ? (isAdmin ? 'Manage church operations, finances, activities and reports.' : 'Record and review the church activities assigned to your team.') : subtitle(page)}</p></div>
          <div className="actions"><button type="button" className="secondary" onClick={() => setPage('reports')}>View reports</button>{isAdmin && <button type="button" className="secondary print-button" onClick={() => printReport('Church records')}>🖨 Print records</button>}</div>
        </div>

        {loading && <section className="card"><p>Loading your church records...</p></section>}
        {!loading && page === 'dashboard' && <Dashboard user={user} reportingContext={reportingContext} attendance={attendance} expenses={visibleExpenses} activities={visibleActivities} weeklyReports={weeklyReports} money={money} open={setModal} go={setPage} isAdmin={isAdmin} />}
        {!loading && page === 'attendance' && <Records title="Service attendance" eyebrow="Attendance records" action="Record attendance" onAdd={() => setModal('attendance')} onCreate={async () => { const name = window.prompt('New attendance option name'); if (!name?.trim()) return; try { const created = await api.createOption({ kind: 'ATTENDANCE', name: name.trim() }); setAttendanceOptions(current => [...current.filter(x => x.name !== created.name), created]); setSync(created.offline ? 'Attendance option saved offline' : 'Backend connected') } catch (error) { setSync(error.message || 'Could not create attendance option') } }} isAdmin={isAdmin} onPrint={() => printReport('Attendance report')}><table><thead><tr><th>Service</th><th>Date</th><th>Total people</th><th>Status</th>{isAdmin && <th>Recorded by</th>}<th>Action</th></tr></thead><tbody>{visibleAttendance.map(r => <tr key={r.id}><td><b>{r.service}</b></td><td>{r.date}</td><td><b>{r.total}</b></td><td><span className="pill">Recorded</span></td>{isAdmin && <td>{r.recordedBy?.name || 'Unknown'}</td>}<td><button type="button" className="danger-button" onClick={()=>deleteAttendanceRecord(r.id)}>Delete</button></td></tr>)}</tbody></table>{!attendance.length && <p>No attendance records yet.</p>}</Records>}
        {!loading && page === 'activities' && <ActivitiesPage user={user} initialDate={reportEditDate || reportingContext?.date} onInitialDateHandled={() => setReportEditDate(null)} />}
        {!loading && page === 'finance' && <FinancePage user={user} initialDate={reportingContext?.date} />}
        {!loading && page === 'staff' && isAdmin && <StaffPage staff={staff} invitations={staffInvitations} staffCount={staffCount} selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} reviews={reviews} attendance={attendance} expenses={expenses} activities={activities} finances={finances} weeklyReports={weeklyReports} onReview={() => setModal('review')} onInvite={() => setModal('invite-staff')} onPrint={() => printReport(selectedStaff ? selectedStaff.name + ' Sunday reviews' : 'Staff report')} onToggleStatus={toggleStaffStatus} onDelete={deleteStaff} />}
        {!loading && page === 'calendar' && <ReportingCalendar user={user} current={reportingContext} />}
        {!loading && page === 'settings' && <SettingsPage user={user} onEditProfile={() => setModal('profile')} onLogout={logout} />}
        {!loading && page === 'reports' && <ReportsPage refreshKey={reportRefresh} user={user} onEdit={openReportEditor} onEditFinance={openFinanceEditor} onEditActivity={openActivityEditor} onEditAttendance={openAttendanceEditor} />}
        
      </section>
    </main>

    {modal === 'profile' && <ProfileForm user={user} close={() => setModal(null)} save={saveProfile} />}
    {modal === 'attendance' && <AttendanceForm close={() => setModal(null)} save={addAttendance} recordingDate={reportingContext?.date} options={attendanceOptions} />}
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
    {modal === 'invite-staff' && <InviteStaffForm close={() => setModal(null)} onSaved={async invitation => { setStaffInvitations(current => [invitation, ...current]); setStaffCount(current => ({ ...current, pending: current.pending + 1, total: current.total + 1 })); setModal({ type: 'staff-code', invitation }) }} />}
    {modal?.type === 'staff-code' && <StaffCodeModal invitation={modal.invitation} close={() => setModal(null)} />}
    {modal === 'review' && selectedStaff && <ReviewForm staff={selectedStaff} close={() => setModal(null)} save={saveReview} />}
    {modal?.type === 'activity-edit' && <ActivityForm initial={modal.record} close={() => setModal(null)} save={updateActivity} />}
    <nav ref={node => { mobileNavRef.current = node }} className="mobile-nav" aria-label="Mobile navigation">
      {[
        ['dashboard','⌂'], ['attendance','◉'], ['activities','▣'], ['finance','₦']
      ].map(([id, icon]) => <button type="button" key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setMobileMoreOpen(false) }}><i aria-hidden="true">{icon}</i><span>{title(id)}</span></button>)}
      <button type="button" className={mobileMoreOpen || ['reports','calendar','staff','settings'].includes(page) ? 'active' : ''} onClick={() => { setMobileMoreOpen(value => !value); setTimeout(() => mobileNavRef.current?.querySelector('.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 0) }} aria-expanded={mobileMoreOpen}>
        <i aria-hidden="true">•••</i><span>More</span>
      </button>
    </nav>
    {mobileMoreOpen && <div className="mobile-more-panel" role="dialog" aria-label="More navigation">
      <div className="mobile-more-head"><div><b>More</b><small>Reports and settings</small></div><button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="Close menu">×</button></div>
      <div className="mobile-more-grid">
        {[
          ['reports','Reports'], ['calendar','Calendar'], ...(isAdmin ? [['staff','Staff']] : []), ['settings','Settings']
        ].map(([id, label]) => <button type="button" key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setMobileMoreOpen(false) }}><span>{label}</span><small>{id === 'calendar' ? 'Set seven-day periods' : id === 'reports' ? 'View summaries' : id === 'settings' ? 'Account and sign out' : 'Manage team'}</small></button>)}
      </div>
    </div>}
  </div>
}

function Dashboard({ user, reportingContext, attendance, expenses, activities, weeklyReports, money, open, go, isAdmin }) {
  const [duration, setDuration] = useState('weekly')
  const todayValue = reportingContext?.date || new Date().toISOString().slice(0, 10)
  const today = new Date(todayValue + 'T12:00:00Z').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const monthLabel = reportingContext?.month ? new Date(Date.UTC(2026, Number(reportingContext.month.month) - 1, 1)).toLocaleDateString('en-NG', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null

  const range = useMemo(() => periodRange(duration, new Date()), [duration])
  const periodAttendance = useMemo(
    () => attendance.filter(item => inPeriod(item.activity?.date, range)),
    [attendance, range],
  )
  const latestAttendance = useMemo(
    () => [...periodAttendance].sort((a, b) => new Date(b.activity?.date || 0) - new Date(a.activity?.date || 0))[0],
    [periodAttendance],
  )
  const periodReports = useMemo(
    () => weeklyReports.filter(report => inPeriod(report.reportDate, range)),
    [weeklyReports, range],
  )
  const periodMoneyIn = useMemo(
    () => periodReports.reduce((sum, report) => sum + Number(report.totalIncome || 0), 0),
    [periodReports],
  )
  const periodMoneyOut = useMemo(
    () => periodReports.reduce((sum, report) => sum + Number(report.totalExpenditure || 0), 0),
    [periodReports],
  )
  const periodBalance = periodMoneyIn - periodMoneyOut
  const durationLabel = duration === 'weekly' ? 'Weekly' : duration === 'monthly' ? 'Monthly' : 'Yearly'
  const latestService = latestAttendance?.service || 'No service yet'
  const latestServiceDate = latestAttendance?.activity?.date
    ? new Date(latestAttendance.activity.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null

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
      {reportingContext?.week ? <p className="reporting-context"><b>{monthLabel} · Week {reportingContext.week.weekNumber}</b><span>{reportingContext.day} · {reportingContext.date}</span></p> : <div className="reporting-context"><b>Calendar week not configured</b><span>An administrator needs to assign today's date to a saved seven-day calendar week.</span>{isAdmin && <button type="button" className="secondary reporting-setup-button" onClick={() => go('calendar')}>Define this week in Calendar settings</button>}</div>}
    </section>

    <section className="dashboard-period card">
      <div>
        <span className="eyebrow">Dashboard summary</span>
        <h2>{durationLabel} overview</h2>
        <p className="card-subtitle">Choose a duration to update the dashboard totals.</p>
      </div>
      <label className="duration-select">
        <span>Select duration</span>
        <select value={duration} onChange={e => setDuration(e.target.value)} aria-label="Select duration">
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </label>
    </section>

    <div className="stats">
      <Stat icon="◷" name="Latest service" value={latestService} note={latestServiceDate || 'No attendance recorded'} />
      <Stat icon="◉" name="People" value={latestAttendance?.total || 0} note="People in latest service" />
      <Stat icon="₦" name="Total money in" value={money(periodMoneyIn)} note={durationLabel} />
      <Stat icon="₦" name="Total money out" value={money(periodMoneyOut)} note={durationLabel} />
      <Stat icon="⌁" name="Total balance" value={money(periodBalance)} note="Money in minus money out" />
    </div>

    <section className="card dashboard-today">
      <div><span className="eyebrow">{durationLabel}</span><h2>{durationLabel} finance snapshot</h2><p className="card-subtitle">Only records saved within the selected duration.</p></div>
      <div className="today-money">
        <div><small>Money in</small><b>{money(periodMoneyIn)}</b></div>
        <div><small>Money out</small><b>{money(periodMoneyOut)}</b></div>
        <div><small>Balance</small><b>{money(periodBalance)}</b></div>
      </div>
    </section>

    <div className="quick">{!isAdmin && <><Action icon="₦" title="Record money in or out" text="Record income received or expenses paid." onClick={() => go('finance')} /><Action icon="▣" title="Record activity" text="Plan a service, meeting, outreach or church program." onClick={() => open('activity')} /></>}{isAdmin && <Action icon="▤" title="Print reports" text="Print attendance, expense and activity tables." onClick={() => go('reports')} />}</div>
    <div className="dash-grid"><ActivityTrend activities={activities} /><Card title="Recent spending"><div className="list">{expenses.slice(0, 5).map(e => <div className="row" key={e.id}><span className="mini">{e.title?.[0] || '₦'}</span><div><b>{e.title}</b><small>{e.category}</small></div><strong>{money(e.amount)}</strong></div>)}</div>{!expenses.length && <p>No expenses recorded yet.</p>}</Card></div>
  </>
}

function ActivityTrend({ activities = [] }) {
  const years = [...new Set(activities.map(item => new Date(item.date).getFullYear()).filter(Number.isFinite))].sort((a, b) => b - a)
  const currentYear = years[0] || new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const names = [...new Set(activities.map(item => String(item.name || '').trim()).filter(Boolean))].sort()
  const [selectedActivity, setSelectedActivity] = useState('')
  useEffect(() => { if (selectedActivity && !names.includes(selectedActivity)) setSelectedActivity('') }, [names.join('|')])
  const monthLabels = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(year, i, 1)).toLocaleDateString('en-NG', { month: 'short', timeZone: 'UTC' }))
  const values = monthLabels.map((_, month) => activities.filter(item => {
    const d = new Date(item.date)
    return d.getUTCFullYear() === Number(year) && d.getUTCMonth() === month && (!selectedActivity || item.name === selectedActivity)
  }).length)
  const max = Math.max(1, ...values)
  const total = values.reduce((a, b) => a + b, 0)
  return <Card title="Activity trend">
    <div className="trend-controls">
      <label>Year<select value={year} onChange={e => setYear(Number(e.target.value))}>{years.length ? years.map(y => <option key={y} value={y}>{y}</option>) : <option value={currentYear}>{currentYear}</option>}</select></label>
      <label>Activity<select value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)}><option value="">All activities</option>{names.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    </div>
    <div className="monthly-bars">{values.map((value, index) => <div className="monthly-bar-col" key={monthLabels[index]}><b>{value}</b><div className="monthly-bar-track"><div className="monthly-bar" style={{ height: Math.max(4, (value / max) * 100) + '%' }} /></div><small>{monthLabels[index]}</small></div>)}</div>
    {!activities.length && <p>No activity data yet.</p>}
    <p className="trend-summary">{selectedActivity ? <><b>{selectedActivity}</b> was recorded {total} time{total === 1 ? '' : 's'} in {year}.</> : <><b>{total}</b> activities were recorded in {year}.</>}</p>
  </Card>
}

function Stat({ icon, name, value, note }) { return <div className="stat"><span className="stat-icon">{icon}</span><div><small>{name}</small><strong>{value}</strong><em>{note}</em></div></div> }
function Action({ icon, title, text, onClick }) { return <button type="button" className="action-card" onClick={onClick}><span className="stat-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><strong>→</strong></button> }
function Card({ title, children }) { return <section className="card"><div className="card-head"><h2>{title}</h2></div>{children}</section> }
function Records({ title, eyebrow, action, onAdd, onCreate, isAdmin, onPrint, children }) { return <section className="card full"><div className="card-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><div className="record-actions">{!isAdmin && <button type="button" className="primary" onClick={onAdd}>{action}</button>}<details className="action-menu"><summary className="secondary">More</summary><div className="action-menu-panel">{!isAdmin && <button type="button" onClick={onCreate}>Create option</button>}{isAdmin && <button type="button" onClick={onPrint}>Print table</button>}</div></details></div></div><div className="table-wrap">{children}</div></section> }
function title(p) { return ({ attendance: 'Attendance', finance: 'Finance', activities: 'Activities', reports: 'Reports', calendar: 'Calendar', staff: 'Staff', settings: 'Settings' })[p] || 'Dashboard' }
function subtitle(p) { return ({ dashboard: 'A clear view of what is happening across your church.', attendance: 'Record and review service attendance.', finance: 'Track money in, money out and the net result.', activities: 'Complete the numerical and spiritual sections of the official weekly report.', reports: 'Turn records into useful summaries.', staff: 'Review and support every staff member.',  })[p] }


function SettingsPage({ user, onEditProfile, onLogout }) {
  return <div className="settings-layout">
    <section className="card full">
      <div className="card-head">
        <div>
          <span className="eyebrow">Account</span>
          <h2>Settings</h2>
          <p className="card-subtitle">Manage your account and session.</p>
        </div>
      </div>
      <div className="settings-account">
        <div className="settings-avatar">{user.name?.slice(0, 2).toUpperCase() || 'ST'}</div>
        <div>
          <b>{user.name || 'User'}</b>
          <span>{user.email}</span>
          <small>{user.role === 'ADMIN' ? 'Administrator' : 'Staff'}</small>
        </div>
      </div>
      <div className="settings-actions">
        <button type="button" className="secondary" onClick={onEditProfile}>Edit profile</button>
        <button type="button" className="primary" onClick={onLogout}>Log out</button>
      </div>
    </section>
  </div>
}

function StaffPage({ staff, invitations = [], staffCount = { active: 0, pending: 0, total: 0 }, selectedStaff, setSelectedStaff, reviews, attendance, expenses, activities, finances, weeklyReports, onReview, onInvite, onPrint, onToggleStatus, onDelete }) {
  const ratingLabel = value => ({ EXCELLENT: 'Excellent', GOOD: 'Good', FAIR: 'Fair', POOR: 'Poor', BAD: 'Bad' }[value] || value || '—')
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('All')
  const departments = ['All', 'Media', 'Technical', 'Security', 'Secretary', 'Others']
  const filteredStaff = staff.filter(item => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || `${item.name} ${item.email} ${item.department || ''} ${item.position || ''}`.toLowerCase().includes(q)
    return matchesQuery && (department === 'All' || item.department === department)
  })
  const recordsFor = item => [
    ...attendance.filter(r => r.recordedBy?.id === item.id).map(r => ({ type: 'Attendance', name: r.service, date: r.date })),
    ...expenses.filter(r => r.recordedBy?.id === item.id).map(r => ({ type: 'Expense', name: r.title || r.description, date: r.date })),
    ...activities.filter(r => r.recordedBy?.id === item.id).map(r => ({ type: 'Activity', name: r.name, date: formatDate(r.date) })),
    ...finances.filter(r => r.recordedBy?.id === item.id).map(r => ({ type: r.type === 'INCOME' ? 'Money in' : 'Money out', name: r.description || r.category, date: r.date || formatDate(r.recordDate) })),
    ...weeklyReports.filter(r => r.createdBy?.id === item.id).map(r => ({ type: 'Weekly report', name: 'Weekly church report', date: formatDate(r.reportDate) })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)

  return <div className="staff-layout">
    <div className="staff-counts">
      <div><small>Active staff</small><b>{staffCount.active}</b></div>
      <div><small>Pending invitations</small><b>{staffCount.pending}</b></div>
      <div><small>Total staff</small><b>{staffCount.total}</b></div>
    </div>

    <section className="card full">
      <div className="card-head">
        <div><span className="eyebrow">Administration</span><h2>Staff management</h2><p className="card-subtitle">Create invitations, manage access and monitor staff reporting activity.</p></div>
        <div className="record-actions"><button className="primary" onClick={onInvite}>Invite staff</button><button className="secondary print-button" onClick={onPrint}>Print</button></div>
      </div>
      <div className="staff-filters">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, department..." aria-label="Search staff" />
        <select value={department} onChange={e => setDepartment(e.target.value)} aria-label="Filter by department">{departments.map(item => <option key={item}>{item}</option>)}</select>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Staff</th><th>Department</th><th>Position</th><th>Status</th><th>Records</th><th>Reviews</th><th></th></tr></thead><tbody>
        {filteredStaff.map(item => <tr key={item.id} className={selectedStaff?.id === item.id ? 'selected-row' : ''}>
          <td><b>{item.name}</b><small className="staff-email">{item.email}</small></td><td>{item.department || '—'}</td><td>{item.position || '—'}</td>
          <td><span className={`pill ${item.isActive ? '' : 'staff-inactive'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></td><td><b>{item.recordCount || 0}</b></td><td>{item.reviewCount || 0}</td>
          <td><button className="secondary small-button" onClick={() => setSelectedStaff(item)}>View</button></td>
        </tr>)}
      </tbody></table>{!filteredStaff.length && <p>No staff members match the current filters.</p>}</div>
    </section>

    <section className="card full">
      <div className="card-head"><div><span className="eyebrow">Onboarding</span><h2>Staff invitations</h2><p className="card-subtitle">Admin creates the invitation; the staff member uses the code to set their own password.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Position</th><th>Status</th><th>Expires</th></tr></thead><tbody>{invitations.map(item => <tr key={item.id}><td><b>{item.name}</b></td><td>{item.email}</td><td>{item.department}</td><td>{item.position || '—'}</td><td><span className="pill">{item.status || 'Unused'}</span></td><td>{formatDate(item.expiresAt)}</td></tr>)}</tbody></table>{!invitations.length && <p>No staff invitations created yet.</p>}</div>
    </section>

    {selectedStaff && <section className="card full">
      <div className="card-head">
        <div><span className="eyebrow">Staff profile</span><h2>{selectedStaff.name}</h2><p className="card-subtitle">{selectedStaff.email} · {selectedStaff.department || 'No department'} · {selectedStaff.position || 'No position'}</p></div>
        <div className="record-actions">
          <button className="secondary" onClick={() => onToggleStatus(selectedStaff)}>{selectedStaff.isActive ? 'Deactivate' : 'Activate'}</button>
          <button className="secondary danger-button" onClick={() => onDelete(selectedStaff)}>Delete permanently</button>
          <button className="primary" onClick={onReview}>Sunday review</button>
        </div>
      </div>
      <div className="staff-profile-grid">
        <div><small>Department</small><b>{selectedStaff.department || '—'}</b></div>
        <div><small>Position</small><b>{selectedStaff.position || '—'}</b></div>
        <div><small>Joined</small><b>{formatDate(selectedStaff.createdAt)}</b></div>
        <div><small>Account</small><b>{selectedStaff.isActive ? 'Active' : 'Inactive'}</b></div>
      </div>
      <div className="staff-record-summary">
        <span className="eyebrow">Reporting activity</span><h3>Recent records</h3>
        <div className="table-wrap"><table><thead><tr><th>Type</th><th>Record</th><th>Date</th></tr></thead><tbody>{recordsFor(selectedStaff).map((r, index) => <tr key={index}><td>{r.type}</td><td><b>{r.name}</b></td><td>{r.date}</td></tr>)}</tbody></table>{!recordsFor(selectedStaff).length && <p>No reporting activity found for this staff member.</p>}</div>
      </div>
      <div className="review-history"><h3>Sunday reviews</h3>{reviews.map(review => <div className="review-card" key={review.id}><div><b>{formatDate(review.reviewDate)}</b><span className={`review-rating rating-${String(review.rating || '').toLowerCase()}`}>{ratingLabel(review.rating)}</span></div><p>{review.comment || 'No comment added.'}</p><small>Reviewed by {review.admin?.name || 'Admin'}</small></div>)}{!reviews.length && <p>No Sunday review has been recorded for this staff member yet.</p>}</div>
    </section>}
  </div>
}

function InviteStaffForm({ close, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', department: 'Secretary', position: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  async function submit() {
    if (saving) return
    setSaving(true); setError('')
    try { const result = await api.createStaffInvitation(form); await onSaved(result.invitation) }
    catch (e) { setError(e.message || 'Could not create staff invitation') }
    finally { setSaving(false) }
  }

  return <Modal title="Invite staff" close={close}>
    <p className="review-intro">Create a one-time invitation. The staff member will use the code to set their own password.</p>
    {error && <div className="auth-error">{error}</div>}
    <label>Full name<input value={form.name} onChange={e => set('name', e.target.value)} required /></label>
    <label>Email<input type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></label>
    <label>Department<select value={form.department} onChange={e => set('department', e.target.value)}>{['Media', 'Technical', 'Security', 'Secretary', 'Others'].map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Position<input value={form.position} onChange={e => set('position', e.target.value)} placeholder="e.g. Media Coordinator" required /></label>
    <button className="primary wide" disabled={saving || form.name.trim().length < 2 || !form.email.includes('@') || form.position.trim().length < 2} onClick={submit}>{saving ? 'Creating…' : 'Create invitation'}</button>
  </Modal>
}

function StaffCodeModal({ invitation, close }) {
  return <Modal title="Invitation created" close={close}>
    <p className="review-intro">Give this code to <b>{invitation.name}</b>. They will use it to load their assigned details and create their password.</p>
    <div className="staff-code-box"><span className="eyebrow">One-time code</span><strong>{invitation.code}</strong><small>{invitation.department} · {invitation.position} · Expires {formatDate(invitation.expiresAt)}</small></div>
    <button className="primary wide" onClick={close}>Done</button>
  </Modal>
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
function ActivityForm({ close, save, initial = null, recordingDate = null }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id,
    name: initial?.name || '',
    type: initial?.type || 'Service',
    date: String(initial?.date || recordingDate || new Date().toISOString()).slice(0, 10),
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
function AttendanceForm({ close, save, initial = null, recordingDate = null, options = [] }) {
  const activity = initial?.activity || {}
  const [service, setService] = useState(initial?.service || activity.name || 'Sunday Service')
  const [date, setDate] = useState(String(initial?.dateRaw || activity.date || recordingDate || new Date().toISOString()).slice(0, 10))
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
    <label>Service<input list="attendance-options" value={service} onChange={e => setService(e.target.value)} /><datalist id="attendance-options">{options.map(option => <option key={option.id || option.name} value={option.name} />)}</datalist></label>
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
function FinanceForm({ close, save, recordingDate = null }) {
  const [form, setForm] = useState({ type: 'INCOME', category: '', amount: '', description: '', recordDate: recordingDate || new Date().toISOString().slice(0, 10) })
  const [options, setOptions] = useState([])
  useEffect(() => { api.options(form.type === 'INCOME' ? 'FINANCE_INCOME' : 'FINANCE_EXPENSE').then(setOptions).catch(() => {}) }, [form.type])
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  async function submit() {
    if (saving || !form.category || !form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    const success = await save(form)
    if (!success) setSaving(false)
  }

  return <Modal title={form.type === 'INCOME' ? 'Submit money in' : 'Submit money out'} close={close}><label>Type<select value={form.type} onChange={e => set('type', e.target.value)}><option value="INCOME">Money in</option><option value="EXPENSE">Money out</option></select></label><label>Category<input list="finance-options" value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Offering" /><datalist id="finance-options">{options.map(option => <option key={option.id || option.name} value={option.name} />)}</datalist></label><button type="button" className="secondary" onClick={async () => { const name = window.prompt(form.type === 'INCOME' ? 'New money-in option name' : 'New money-out option name'); if (!name?.trim()) return; try { const created = await api.createOption({ kind: form.type === 'INCOME' ? 'FINANCE_INCOME' : 'FINANCE_EXPENSE', name: name.trim() }); setOptions(current => [...current.filter(x => x.name !== created.name), created]); set('category', created.name) } catch (error) { alert(error.message || 'Could not create option') } }}>Create category</button><label>Description<input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description" /></label><label>Amount<input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" /></label><label>Date<input type="date" value={form.recordDate} onChange={e => set('recordDate', e.target.value)} /></label><button type="button" className="primary wide" disabled={saving || !form.category || !form.amount || Number(form.amount) <= 0} onClick={submit}>{saving ? 'Saving…' : 'Submit transaction'}</button></Modal>
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
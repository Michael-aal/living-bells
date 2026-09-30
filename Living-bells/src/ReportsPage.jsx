import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { dateLabel, money } from './weeklyReportConfig'
import './ReportsPage.css'

const pad = value => String(value).padStart(2, '0')
const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
const keyOf = value => String(value || '').slice(0, 10)
const displayDate = value => {
  const key = keyOf(value)
  if (!key) return '—'
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })
}
const relativeDate = value => {
  const key = keyOf(value)
  const today = todayKey()
  const yesterdayDate = new Date(`${today}T12:00:00`)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = `${yesterdayDate.getFullYear()}-${pad(yesterdayDate.getMonth() + 1)}-${pad(yesterdayDate.getDate())}`
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-NG', { weekday: 'long' })
}

export default function ReportsPage({ user, refreshKey = 0, onEdit, onEditFinance, onEditActivity, onEditAttendance }) {
  const [reports, setReports] = useState([])
  const [activities, setActivities] = useState([])
  const [attendance, setAttendance] = useState([])
  const [expenses, setExpenses] = useState([])
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [date, setDate] = useState('')
  const [year, setYear] = useState('')
  const [amount, setAmount] = useState('')
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canEditOperational = user?.role === 'STAFF'

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError('')
        const [weekly, activityRows, attendanceRows, legacyExpenses] = await Promise.all([
          api.weeklyReports(),
          api.activities(),
          api.attendance(),
          api.expenses(),
        ])
        if (cancelled) return
        setReports(weekly || [])
        setActivities(activityRows || [])
        setAttendance(attendanceRows || [])
        setExpenses((legacyExpenses || []).map(item => ({ ...item, amount: Number(item.amount || 0) })))
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  const filteredReports = useMemo(() => reports.filter(report => {
    const reportDate = keyOf(report.reportDate)
    const target = date || selectedDate
    const amountTarget = Number(amount)
    const amountMatch = !amount || [report.totalIncome, report.totalExpenditure, report.balance]
      .some(value => Math.abs(Number(value || 0) - amountTarget) < 0.005)
    return reportDate === target && (!year || reportDate.startsWith(year)) && amountMatch
  }), [reports, date, selectedDate, year, amount])

  const day = useMemo(() => {
    const target = selectedDate
    const finance = reports.find(report => keyOf(report.reportDate) === target) || null
    const dayActivities = activities.filter(item => keyOf(item.date) === target)
    const dayAttendance = attendance.filter(item => keyOf(item.activity?.date) === target)
    const dayExpenses = expenses.filter(item => keyOf(item.date || item.recordDate) === target)
    const income = finance ? Number(finance.totalIncome || 0) : 0
    const out = finance ? Number(finance.totalExpenditure || 0) : 0
    const attendanceTotal = dayAttendance.reduce((sum, item) => sum + attendanceTotalFor(item), 0)
    return {
      finance,
      activities: dayActivities,
      attendance: dayAttendance,
      expenses: dayExpenses,
      income,
      out,
      balance: income - out,
      attendanceTotal,
    }
  }, [selectedDate, reports, activities, attendance, expenses])

  function clearFilters() {
    setDate('')
    setYear('')
    setAmount('')
  }

  function chooseDate(value) {
    setSelectedDate(value)
    setDate('')
  }

  return <div className="reports-page">
    <section className="card full report-date-hero">
      <div>
        <span className="eyebrow">Daily archive</span>
        <h2>{relativeDate(selectedDate)} · {displayDate(selectedDate)}</h2>
        <p className="card-subtitle">One date connects the saved attendance, finance and activity records. Pick any date to see what was recorded that day.</p>
      </div>
      <label className="report-date-picker">Date<input type="date" value={selectedDate} onChange={e => chooseDate(e.target.value)} /></label>
    </section>

    <section className="report-money-grid">
      <MoneyCard title="Money in" value={day.income} note={day.finance ? 'From saved weekly finance report' : 'No saved finance report for this date'} />
      <MoneyCard title="Money out" value={day.out} note={day.finance ? 'From saved weekly finance report' : 'No saved finance report for this date'} />
      <MoneyCard title="Balance" value={day.balance} note={`${day.attendanceTotal.toLocaleString('en-NG')} attendance recorded`} />
    </section>

    {error && <div className="toast toast-error" role="alert">{error}</div>}

    <section className="daily-record-grid">
      <DailyCard
        eyebrow="Section 1"
        title="Attendance"
        count={day.attendance.length}
        empty="No attendance was saved for this date."
        onReview={item => setReview({ type: 'attendance', item })}
        onEdit={canEditOperational ? onEditAttendance : null}
      >
        {day.attendance.map(item => <RecordRow key={item.id} title={item.activity?.name || 'Service attendance'} meta={`${attendanceTotalFor(item).toLocaleString('en-NG')} people · ${item.recordedBy?.name || 'Unknown'}`} actionLabel="Review" onAction={() => setReview({ type: 'attendance', item })} edit={canEditOperational ? () => onEditAttendance(item) : null} />)}
      </DailyCard>

      <DailyCard
        eyebrow="Section 2"
        title="Finance"
        count={day.finance ? 1 : 0}
        empty="No weekly finance report was saved for this date."
        onReview={item => setReview({ type: 'finance', item })}
        onEdit={onEditFinance || onEdit}
      >
        {day.finance && <RecordRow title="Weekly finance report" meta={`In ${money(day.income)} · Out ${money(day.out)} · Balance ${money(day.balance)}`} actionLabel="Review" onAction={() => setReview({ type: 'finance', item: day.finance })} edit={() => (onEditFinance || onEdit)?.(selectedDate)} />}
      </DailyCard>

      <DailyCard
        eyebrow="Section 3"
        title="Activities"
        count={day.activities.length}
        empty="No activities were saved for this date."
        onReview={item => setReview({ type: 'activity', item })}
        onEdit={canEditOperational ? onEditActivity : null}
      >
        {day.activities.map(item => <RecordRow key={item.id} title={item.name} meta={`${item.type || 'Activity'} · ${item.recordedBy?.name || 'Unknown'}`} actionLabel="Review" onAction={() => setReview({ type: 'activity', item })} edit={canEditOperational ? () => onEditActivity(item) : null} />)}
      </DailyCard>
    </section>

    <section className="archive-section-grid">
      <ArchiveAttendance reports={reports} attendance={attendance} />
      <ArchiveActivities reports={reports} activities={activities} />
      <ArchiveFinance reports={reports} onReview={item => { setSelectedDate(keyOf(item.reportDate)); setReview({ type: 'finance', item }) }} onEdit={date => (onEditFinance || onEdit)?.(date)} />
    </section>

    <section className="card full">
      <div className="card-head"><div><span className="eyebrow">Stored legacy records</span><h2>Money out records</h2><p className="card-subtitle">Legacy Expense records remain visible here separately so they are not double-counted inside the official weekly finance totals.</p></div></div>
      {day.expenses.length ? <div className="table-wrap"><table><thead><tr><th>Description</th><th>Category</th><th>Money out</th></tr></thead><tbody>{day.expenses.map(item => <tr key={item.id}><td><b>{item.description || item.title || 'Expense'}</b></td><td>{item.category || 'General'}</td><td>{money(item.amount)}</td></tr>)}</tbody></table></div> : <p>No legacy Expense records for this date.</p>}
    </section>

    {review && <DailyReview review={review} close={() => setReview(null)} />}
    <ReportsPrintSheet day={day} selectedDate={selectedDate} />
  </div>
}

function attendanceTotalFor(item) {
  return ['childrenMale', 'childrenFemale', 'teenagersMale', 'teenagersFemale', 'youthMale', 'youthFemale', 'adultsMale', 'adultsFemale']
    .reduce((sum, key) => sum + Number(item[key] || 0), 0)
}

function ArchiveAttendance({ reports, attendance }) {
  const rows = useMemo(() => attendance.reduce((map, item) => {
    const date = keyOf(item.activity?.date || item.date || item.recordDate)
    if (!date) return map
    const current = map.get(date) || { date, children: 0, teenagers: 0, youth: 0, adults: 0, total: 0 }
    current.children += Number(item.childrenMale || 0) + Number(item.childrenFemale || 0)
    current.teenagers += Number(item.teenagersMale || 0) + Number(item.teenagersFemale || 0)
    current.youth += Number(item.youthMale || 0) + Number(item.youthFemale || 0)
    current.adults += Number(item.adultsMale || 0) + Number(item.adultsFemale || 0)
    current.total = current.children + current.teenagers + current.youth + current.adults
    map.set(date, current); return map
  }, new Map()), [attendance])
  return <section className="card full archive-card"><div className="card-head"><div><span className="eyebrow">Past attendance</span><h2>Attendance history</h2><p className="card-subtitle">Attendance totals only: children, teenagers, youth and adults.</p></div></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Children</th><th>Teenagers</th><th>Youth</th><th>Adults</th><th>Total</th></tr></thead><tbody>{Array.from(rows.values()).sort((a,b)=>b.date.localeCompare(a.date)).map(row=><tr key={row.date}><td><b>{dateLabel(row.date)}</b></td><td>{row.children}</td><td>{row.teenagers}</td><td>{row.youth}</td><td>{row.adults}</td><td><b>{row.total}</b></td></tr>)}</tbody></table></div> : <p>No past attendance records.</p>}</section>
}

function ArchiveActivities({ reports, activities }) {
  const rows = useMemo(() => reports.map(report => {
    const numerical = Array.isArray(report.numerical) ? report.numerical : []
    const adult = numerical.reduce((sum,row)=>sum+Number(row.adult||0),0)
    const children = numerical.reduce((sum,row)=>sum+Number(row.children||0),0)
    const visitor = numerical.reduce((sum,row)=>sum+Number(row.visitor||0),0)
    const spiritual = report.spiritual || {}
    return { date:keyOf(report.reportDate), services:numerical.length, adult, children, visitor, total:adult+children+visitor, decisions:Number(spiritual['No. of Decision']||0), baptisms:Number(spiritual['No. of Water Baptism']||0) }
  }).sort((a,b)=>b.date.localeCompare(a.date)), [reports])
  return <section className="card full archive-card"><div className="card-head"><div><span className="eyebrow">Past activities</span><h2>Activities history</h2><p className="card-subtitle">Activity report totals only: people recorded across the services and key spiritual results.</p></div></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Services</th><th>Adults</th><th>Children</th><th>Visitors</th><th>Total people</th><th>Decisions</th><th>Water Baptism</th></tr></thead><tbody>{rows.map(row=><tr key={row.date}><td><b>{dateLabel(row.date)}</b></td><td>{row.services}</td><td>{row.adult}</td><td>{row.children}</td><td>{row.visitor}</td><td><b>{row.total}</b></td><td>{row.decisions}</td><td>{row.baptisms}</td></tr>)}</tbody></table></div> : <p>No past activity reports.</p>}</section>
}

function ArchiveFinance({ reports, onReview, onEdit }) {
  return <section className="card full archive-card"><div className="card-head"><div><span className="eyebrow">Past finance</span><h2>Finance history</h2><p className="card-subtitle">Finance totals only: money in, money out and balance.</p></div></div>{reports.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Money in</th><th>Money out</th><th>Balance</th><th>Actions</th></tr></thead><tbody>{reports.map(report=><tr key={report.id}><td><b>{dateLabel(report.reportDate)}</b></td><td>{money(report.totalIncome)}</td><td>{money(report.totalExpenditure)}</td><td>{money(report.balance)}</td><td><div className="report-row-actions"><button className="secondary small-button" onClick={()=>onReview(report)}>Review</button><button className="secondary small-button" onClick={()=>onEdit(keyOf(report.reportDate))}>Edit</button></div></td></tr>)}</tbody></table></div> : <p>No past finance reports.</p>}</section>
}

function MoneyCard({ title, value, note }) {
  return <section className="card money-summary"><span className="eyebrow">{title}</span><h3>{money(value)}</h3><p>{note}</p></section>
}

function DailyCard({ eyebrow, title, count, empty, children }) {
  return <section className="card daily-card"><div className="card-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span className="record-count">{count}</span></div>{count ? <div className="daily-record-list">{children}</div> : <p>{empty}</p>}</section>
}

function RecordRow({ title, meta, onAction, edit }) {
  return <div className="daily-record-row"><div><b>{title}</b><small>{meta}</small></div><div className="report-row-actions"><button className="secondary small-button" onClick={onAction}>Review</button>{edit && <button className="secondary small-button" onClick={edit}>Edit</button>}</div></div>
}

function DailyReview({ review, close }) {
  const { type, item } = review
  return <div className="backdrop" onMouseDown={close}>
    <div className="modal report-review-modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">Daily record</span><h2>{type[0].toUpperCase() + type.slice(1)} · {displayDate(type === 'finance' ? item.reportDate : type === 'activity' ? item.date : item.activity?.date)}</h2></div><button className="close" onClick={close}>×</button></div>
      {type === 'activity' && <div className="review-detail-list"><Detail label="Activity" value={item.name} /><Detail label="Type" value={item.type || '—'} /><Detail label="Recorded by" value={item.recordedBy?.name || 'Unknown'} /></div>}
      {type === 'attendance' && <><div className="review-total-grid"><Detail label="Service" value={item.activity?.name || 'Service'} /><Detail label="Total people" value={attendanceTotalFor(item).toLocaleString('en-NG')} /><Detail label="Recorded by" value={item.recordedBy?.name || 'Unknown'} /></div><div className="review-detail-list">{[['Children male',item.childrenMale],['Children female',item.childrenFemale],['Teenagers male',item.teenagersMale],['Teenagers female',item.teenagersFemale],['Youth male',item.youthMale],['Youth female',item.youthFemale],['Adults male',item.adultsMale],['Adults female',item.adultsFemale]].map(([label,value])=><Detail key={label} label={label} value={Number(value||0).toLocaleString('en-NG')} />)}</div></>}
      {type === 'finance' && <><div className="review-total-grid"><Detail label="Money in" value={money(item.totalIncome)} /><Detail label="Money out" value={money(item.totalExpenditure)} /><Detail label="Balance" value={money(item.balance)} /></div><div className="review-finance"><h3>Money in details</h3>{(item.income || []).map(row => <p key={row.sn}><span>{row.name || 'Other income'}</span><b>{money(row.amount)}</b></p>)}<h3>Money out details</h3>{(item.expenditure || []).map(row => <p key={row.sn}><span>{row.name || 'Other expenditure'}</span><b>{money(row.amount)}</b></p>)}</div></>}
      <div className="record-actions"><button className="secondary" onClick={() => window.print()}>Print / PDF</button><button className="primary" onClick={close}>Done</button></div>
    </div>
  </div>
}

function Detail({ label, value }) {
  return <div className="detail-item"><small>{label}</small><b>{value}</b></div>
}

function ReportsPrintSheet({ day, selectedDate }) {
  const finance = day.finance
  return <section className="reports-print-sheet" aria-label="Printable church report">
    <header className="reports-print-header"><strong>FOURSQUARE GOSPEL CHURCH, THE BELLS</strong><span>DAILY RECORD REPORT</span><small>DATE: {displayDate(selectedDate)}</small></header>
    <h3>1. ATTENDANCE</h3>
    <table><thead><tr><th>Service</th><th>Children M</th><th>Children F</th><th>Teenagers M</th><th>Teenagers F</th><th>Youth M</th><th>Youth F</th><th>Adults M</th><th>Adults F</th><th>Total</th></tr></thead><tbody>{day.attendance.length ? day.attendance.map(item => <tr key={item.id}><td>{item.activity?.name || 'Service'}</td><td>{Number(item.childrenMale||0)}</td><td>{Number(item.childrenFemale||0)}</td><td>{Number(item.teenagersMale||0)}</td><td>{Number(item.teenagersFemale||0)}</td><td>{Number(item.youthMale||0)}</td><td>{Number(item.youthFemale||0)}</td><td>{Number(item.adultsMale||0)}</td><td>{Number(item.adultsFemale||0)}</td><td>{attendanceTotalFor(item)}</td></tr>) : <tr><td colSpan="10">No attendance record saved.</td></tr>}</tbody></table>
    <h3>2. ACTIVITIES</h3>
    <table><thead><tr><th>Activity</th><th>Type</th><th>Recorded by</th></tr></thead><tbody>{day.activities.length ? day.activities.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.type || 'Activity'}</td><td>{item.recordedBy?.name || 'Unknown'}</td></tr>) : <tr><td colSpan="3">No activity record saved.</td></tr>}</tbody></table>
    <h3>3. FINANCE — MONEY IN</h3>
    <table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>{finance?.income?.length ? finance.income.map(row => <tr key={row.sn}><td>{row.name || 'Other income'}</td><td>{money(row.amount)}</td></tr>) : <tr><td>No finance report saved</td><td>{money(0)}</td></tr>}<tr><th>TOTAL MONEY IN</th><th>{money(day.income)}</th></tr></tbody></table>
    <h3>4. FINANCE — MONEY OUT</h3>
    <table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>{finance?.expenditure?.length ? finance.expenditure.map(row => <tr key={row.sn}><td>{row.name || 'Other expenditure'}</td><td>{money(row.amount)}</td></tr>) : <tr><td>No finance report saved</td><td>{money(0)}</td></tr>}<tr><th>TOTAL MONEY OUT</th><th>{money(day.out)}</th></tr></tbody></table>
    <div className="reports-print-balance">BALANCE: {money(day.balance)}</div>
  </section>
}

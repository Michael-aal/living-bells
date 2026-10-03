import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { money } from './weeklyReportConfig'
import './ReportsPage.css'

const pad = value => String(value).padStart(2, '0')
const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
const keyOf = value => String(value || '').slice(0, 10)

function parseDate(value) {
  const key = keyOf(value)
  if (!key) return null
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function displayDate(value) {
  const date = parseDate(value)
  return date ? date.toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
}

function formatNumber(value, decimals = 0) {
  return Number(value || 0).toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function average(total, count) {
  return count ? total / count : 0
}

function roundAverage(value) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2))
}

function startOfWeek(value) {
  const date = parseDate(value) || new Date()
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  start.setHours(0, 0, 0, 0)
  return start
}

function endOfWeek(value) {
  const start = startOfWeek(value)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function inRange(value, start, end) {
  const date = parseDate(value)
  return date && date >= start && date <= end
}

function reportingYearStart(year) {
  return new Date(Number(year), 6, 1, 0, 0, 0, 0)
}

function reportingYearEnd(year) {
  return new Date(Number(year) + 1, 5, 30, 23, 59, 59, 999)
}

function reportingYearLabel(year) {
  return `${Number(year)}/${String(Number(year) + 1).slice(-2)}`
}

function periodLabel(mode, anchor) {
  if (mode === 'week') {
    return `Week of ${startOfWeek(anchor).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }
  if (mode === 'month') {
    const date = parseDate(anchor)
    return date.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
  }
  return `Reporting year ${reportingYearLabel(parseDate(anchor)?.getFullYear() || new Date().getFullYear())}`
}

function rowsFromJson(value) {
  return Array.isArray(value) ? value : []
}

function numberFromRow(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return Number(row[key]) || 0
  }
  return 0
}

export default function ReportsPage({ user, refreshKey = 0, onEdit, onEditFinance, onEditActivity, onEditAttendance }) {
  const [reports, setReports] = useState([])
  const [activities, setActivities] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('week')
  const [anchor, setAnchor] = useState(todayKey())
  const [review, setReview] = useState(null)

  const canEditOperational = user?.role === 'STAFF'

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError('')
        const [weekly, activityRows, attendanceRows] = await Promise.all([
          api.weeklyReports(),
          api.activities(),
          api.attendance(),
        ])
        if (cancelled) return
        setReports(weekly || [])
        setActivities(activityRows || [])
        setAttendance(attendanceRows || [])
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  const range = useMemo(() => {
    const selected = parseDate(anchor) || new Date()
    if (mode === 'week') return { start: startOfWeek(anchor), end: endOfWeek(anchor) }
    if (mode === 'month') return {
      start: new Date(selected.getFullYear(), selected.getMonth(), 1, 0, 0, 0, 0),
      end: new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 23, 59, 59, 999),
    }
    const reportingYear = selected.getFullYear()
    return {
      start: reportingYearStart(reportingYear),
      end: reportingYearEnd(reportingYear),
    }
  }, [mode, anchor])

  const selectedReports = useMemo(
    () => reports.filter(report => inRange(report.reportDate, range.start, range.end)),
    [reports, range],
  )

  const selectedAttendance = useMemo(
    () => attendance.filter(item => inRange(item.activity?.date || item.date || item.recordDate, range.start, range.end)),
    [attendance, range],
  )

  const selectedActivities = useMemo(
    () => activities.filter(item => inRange(item.date, range.start, range.end)),
    [activities, range],
  )

  const attendanceSummary = useMemo(() => {
    const keys = [
      ['Children male', 'childrenMale'],
      ['Children female', 'childrenFemale'],
      ['Teenagers male', 'teenagersMale'],
      ['Teenagers female', 'teenagersFemale'],
      ['Youth male', 'youthMale'],
      ['Youth female', 'youthFemale'],
      ['Adults male', 'adultsMale'],
      ['Adults female', 'adultsFemale'],
    ]
    const values = keys.map(([label, key]) => {
      const total = selectedAttendance.reduce((sum, item) => sum + Number(item[key] || 0), 0)
      return { label, total, average: roundAverage(average(total, selectedAttendance.length)) }
    })
    const groups = [
      ['Children', ['childrenMale', 'childrenFemale']],
      ['Teenagers', ['teenagersMale', 'teenagersFemale']],
      ['Youth', ['youthMale', 'youthFemale']],
      ['Adults', ['adultsMale', 'adultsFemale']],
    ].map(([label, groupKeys]) => {
      const total = selectedAttendance.reduce((sum, item) => sum + groupKeys.reduce((n, key) => n + Number(item[key] || 0), 0), 0)
      return { label, total, average: roundAverage(average(total, selectedAttendance.length)) }
    })
    const maleTotal = selectedAttendance.reduce((sum, item) => sum + Number(item.childrenMale || 0) + Number(item.teenagersMale || 0) + Number(item.youthMale || 0) + Number(item.adultsMale || 0), 0)
    const femaleTotal = selectedAttendance.reduce((sum, item) => sum + Number(item.childrenFemale || 0) + Number(item.teenagersFemale || 0) + Number(item.youthFemale || 0) + Number(item.adultsFemale || 0), 0)
    const total = maleTotal + femaleTotal
    return {
      rows: values,
      groups,
      maleTotal,
      femaleTotal,
      total,
      average: roundAverage(average(total, selectedAttendance.length)),
      recordCount: selectedAttendance.length,
    }
  }, [selectedAttendance])

  const activitySummary = useMemo(() => {
    const categoryMap = new Map()
    let serviceRows = 0
    let decisions = 0
    let waterBaptism = 0

    selectedReports.forEach(report => {
      const numerical = rowsFromJson(report.numerical)
      serviceRows += numerical.length
      numerical.forEach(row => {
        const category = String(row?.service || row?.name || 'Other activity').trim() || 'Other activity'
        const adult = numberFromRow(row, ['adult', 'adults'])
        const children = numberFromRow(row, ['children', 'child'])
        const visitor = numberFromRow(row, ['visitor', 'visitors'])
        const current = categoryMap.get(category) || { label: category, adults: 0, children: 0, visitors: 0 }
        current.adults += adult
        current.children += children
        current.visitors += visitor
        categoryMap.set(category, current)
      })
      const spiritual = report.spiritual || {}
      decisions += Number(spiritual['No. of Decision'] || spiritual.decisions || 0)
      waterBaptism += Number(spiritual['No. of Water Baptism'] || spiritual.waterBaptism || 0)
    })

    const denominator = selectedReports.length || 0
    const rows = Array.from(categoryMap.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(row => ({
        label: row.label,
        averageAdult: roundAverage(average(row.adults, denominator)),
        averageChildren: roundAverage(average(row.children, denominator)),
        total: row.adults + row.children + row.visitors,
      }))

    const adultTotal = rows.reduce((sum, row) => sum + row.averageAdult, 0)
    const childrenTotal = rows.reduce((sum, row) => sum + row.averageChildren, 0)
    const overallTotal = Array.from(categoryMap.values()).reduce((sum, row) => sum + row.adults + row.children + row.visitors, 0)

    return {
      rows,
      total: overallTotal,
      averageAdult: roundAverage(average(
        Array.from(categoryMap.values()).reduce((sum, row) => sum + row.adults, 0),
        denominator,
      )),
      averageChildren: roundAverage(average(
        Array.from(categoryMap.values()).reduce((sum, row) => sum + row.children, 0),
        denominator,
      )),
      reports: selectedReports.length,
      serviceRows,
      decisions,
      waterBaptism,
    }
  }, [selectedReports])

  const financeSummary = useMemo(() => {
    let income = 0
    let expenditure = 0
    const incomeMap = new Map()
    const expenditureMap = new Map()

    selectedReports.forEach(report => {
      income += Number(report.totalIncome || 0)
      expenditure += Number(report.totalExpenditure || 0)

      rowsFromJson(report.income).forEach(row => {
        const name = String(row.name || row.category || 'Other income').trim() || 'Other income'
        const value = Number(row.amount || 0)
        incomeMap.set(name, (incomeMap.get(name) || 0) + value)
      })

      rowsFromJson(report.expenditure).forEach(row => {
        const name = String(row.name || row.category || 'Other expenditure').trim() || 'Other expenditure'
        const value = Number(row.amount || 0)
        expenditureMap.set(name, (expenditureMap.get(name) || 0) + value)
      })
    })

    const categories = Array.from(new Set([...incomeMap.keys(), ...expenditureMap.keys()])).sort()
      .map(category => ({
        category,
        income: incomeMap.get(category) || 0,
        expenditure: expenditureMap.get(category) || 0,
      }))

    return {
      income,
      expenditure,
      balance: income - expenditure,
      incomeAverage: roundAverage(average(income, selectedReports.length)),
      expenditureAverage: roundAverage(average(expenditure, selectedReports.length)),
      balanceAverage: roundAverage(average(income - expenditure, selectedReports.length)),
      categories,
      records: selectedReports.length,
    }
  }, [selectedReports])

  const periodRows = useMemo(() => {
    if (mode === 'year') {
      const year = range.start.getFullYear()
      return Array.from({ length: 12 }, (_, monthIndex) => {
        const month = (6 + monthIndex) % 12
        const calendarYear = month >= 6 ? year : year + 1
        const start = new Date(calendarYear, month, 1)
        const end = new Date(calendarYear, month + 1, 0, 23, 59, 59, 999)
        const rows = reports.filter(report => inRange(report.reportDate, start, end))
        return buildPeriodRow(start, rows, attendance, activities)
      })
    }
    if (mode === 'month') {
      const rows = selectedReports.slice().sort((a, b) => keyOf(a.reportDate).localeCompare(keyOf(b.reportDate)))
      return rows.map(report => {
        const start = parseDate(report.reportDate)
        return buildPeriodRow(start, [report], attendance, activities)
      })
    }
    return selectedReports.length
      ? selectedReports.slice().sort((a, b) => keyOf(a.reportDate).localeCompare(keyOf(b.reportDate))).map(report => buildPeriodRow(parseDate(report.reportDate), [report], attendance, activities))
      : [{ date: range.start, reports: 0, attendance: 0, activities: 0, income: 0, expenditure: 0, balance: 0 }]
  }, [mode, range, reports, selectedReports, attendance, activities])

  return <div className="reports-page">
    <section className="card full reports-hero">
      <div>
        <span className="eyebrow">Reports</span>
        <h2>Weekly, monthly and yearly summaries</h2>
        <p className="card-subtitle">Attendance, activities and finance are calculated separately from the records that were actually saved.</p>
      </div>
      <button className="secondary" onClick={() => window.print()}>Print report</button>
    </section>

    <section className="card full report-controls">
      <div className="report-period-tabs" role="tablist" aria-label="Report period">
        {['week', 'month', 'year'].map(item => <button key={item} type="button" className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
      <label>
        {mode === 'week' ? 'Choose a date in the week' : mode === 'month' ? 'Choose a month' : 'Reporting year (July–June)'}
        <input type={mode === 'year' ? 'number' : mode === 'month' ? 'month' : 'date'} value={mode === 'year' ? String(parseDate(anchor)?.getFullYear() || new Date().getFullYear()) : mode === 'month' ? keyOf(anchor).slice(0, 7) : anchor} onChange={e => {
          const value = e.target.value
          setAnchor(mode === 'year' ? `${value}-07-01` : mode === 'month' ? `${value}-01` : value)
        }} />
      </label>
      <div className="period-summary">
        <span className="eyebrow">Selected period</span>
        <strong>{periodLabel(mode, anchor)}</strong>
        {mode === 'year' && <small>July ${parseDate(anchor)?.getFullYear() || new Date().getFullYear()} through June ${(parseDate(anchor)?.getFullYear() || new Date().getFullYear()) + 1}</small>}
        <small>{selectedReports.length} official weekly report{selectedReports.length === 1 ? '' : 's'} · {selectedAttendance.length} attendance record{selectedAttendance.length === 1 ? '' : 's'}</small>
      </div>
    </section>

    {error && <div className="toast toast-error" role="alert">{error}</div>}
    {loading ? <section className="card full"><p>Loading reports…</p></section> : <>
      <ReportSection title="Attendance" eyebrow="Special services" description="Attendance is kept separate from activities. Every gender and age category is shown with its period total and average." action={canEditOperational ? () => onEditAttendance?.() : null}>
        <SummaryTable headers={['Category', 'Total', 'Average']} rows={attendanceSummary.rows.map(row => [row.label, formatNumber(row.total), formatNumber(row.average, Number.isInteger(row.average) ? 0 : 2)])} totalRow={['Overall attendance', formatNumber(attendanceSummary.total), formatNumber(attendanceSummary.average, Number.isInteger(attendanceSummary.average) ? 0 : 2)]} />
        <div className="report-subtable-grid">
          <MiniTable title="Gender breakdown" headers={['Gender', 'Total', 'Average']} rows={[
            ['Male', formatNumber(attendanceSummary.maleTotal), formatNumber(roundAverage(average(attendanceSummary.maleTotal, attendanceSummary.recordCount)))],
            ['Female', formatNumber(attendanceSummary.femaleTotal), formatNumber(roundAverage(average(attendanceSummary.femaleTotal, attendanceSummary.recordCount)))],
          ]} />
          <MiniTable title="Age-group breakdown" headers={['Group', 'Total', 'Average']} rows={attendanceSummary.groups.map(row => [row.label, formatNumber(row.total), formatNumber(row.average, Number.isInteger(row.average) ? 0 : 2)])} />
        </div>
      </ReportSection>

      <ReportSection title="Activities" eyebrow="Weekly activity report" description="Activities are calculated independently from attendance using the Adults, Children and Visitors columns in each saved weekly report." action={canEditOperational ? () => onEditActivity?.() : null}>
        <SummaryTable headers={['Category', 'Average adult attendance', 'Average children attendance', 'Total']} rows={activitySummary.rows.map(row => [
          row.label,
          formatNumber(row.averageAdult, Number.isInteger(row.averageAdult) ? 0 : 2),
          formatNumber(row.averageChildren, Number.isInteger(row.averageChildren) ? 0 : 2),
          formatNumber(row.total),
        ])} totalRow={['Overall activity attendance', formatNumber(activitySummary.averageAdult, Number.isInteger(activitySummary.averageAdult) ? 0 : 2), formatNumber(activitySummary.averageChildren, Number.isInteger(activitySummary.averageChildren) ? 0 : 2), formatNumber(activitySummary.total)]} />
        <div className="report-subtable-grid">
          <MiniTable title="Activity records" headers={['Measure', 'Value']} rows={[
            ['Weekly reports', formatNumber(activitySummary.reports)],
            ['Service/activity rows', formatNumber(activitySummary.serviceRows)],
            ['Decisions', formatNumber(activitySummary.decisions)],
            ['Water baptism', formatNumber(activitySummary.waterBaptism)],
          ]} />
          <PeriodBreakdown title={mode === 'year' ? 'Monthly activity/attendance totals' : 'Records inside this period'} rows={periodRows.map(row => [formatPeriodDate(row.date, mode), formatNumber(row.activities), formatNumber(row.attendance)])} headers={['Period', 'Activity', 'Attendance']} />
        </div>
      </ReportSection>

      <ReportSection title="Finance" eyebrow="Money in and money out" description="Finance uses the saved weekly finance reports. Money in, money out and balance are totaled for the period; category totals stay visible." action={onEditFinance || onEdit ? () => (onEditFinance || onEdit)?.() : null}>
        <div className="finance-total-grid">
          <Metric label="Total money in" value={money(financeSummary.income)} />
          <Metric label="Total money out" value={money(financeSummary.expenditure)} />
          <Metric label="Net balance" value={money(financeSummary.balance)} />
        </div>
        <SummaryTable headers={['Finance measure', 'Total', 'Average per saved weekly report']} rows={[
          ['Money in', money(financeSummary.income), money(financeSummary.incomeAverage)],
          ['Money out', money(financeSummary.expenditure), money(financeSummary.expenditureAverage)],
          ['Balance', money(financeSummary.balance), money(financeSummary.balanceAverage)],
        ]} />
        <div className="report-subtable-grid">
          <MiniTable title="Finance categories" headers={['Category', 'Money in', 'Money out']} rows={financeSummary.categories.map(row => [row.category, money(row.income), money(row.expenditure)])} empty="No finance categories were saved in this period." />
          <PeriodBreakdown title={mode === 'year' ? 'Monthly finance totals' : 'Saved weekly reports'} headers={['Period', 'Money in', 'Money out', 'Balance']} rows={periodRows.map(row => [formatPeriodDate(row.date, mode), money(row.income), money(row.expenditure), money(row.balance)])} />
        </div>
      </ReportSection>

      <section className="card full">
        <div className="card-head">
          <div>
            <span className="eyebrow">Period records</span>
            <h2>{periodLabel(mode, anchor)} breakdown</h2>
            <p className="card-subtitle">A compact table of the records contributing to this report period.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Period</th><th>Reports</th><th>Attendance</th><th>Activities</th><th>Money in</th><th>Money out</th><th>Balance</th></tr></thead>
            <tbody>{periodRows.map((row, index) => <tr key={`${keyOf(row.date)}-${index}`}><td><b>{formatPeriodDate(row.date, mode)}</b></td><td>{formatNumber(row.reports)}</td><td>{formatNumber(row.attendance)}</td><td>{formatNumber(row.activities)}</td><td>{money(row.income)}</td><td>{money(row.expenditure)}</td><td>{money(row.balance)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>}

    {review && <DailyReview review={review} close={() => setReview(null)} />}
  </div>
}

function buildPeriodRow(date, reports, attendance, activities) {
  const start = date instanceof Date ? date : parseDate(date)
  const key = keyOf(start)
  const reportKeys = new Set(reports.map(report => keyOf(report.reportDate)))
  const attendanceRows = attendance.filter(item => {
    const itemDate = keyOf(item.activity?.date || item.date || item.recordDate)
    return reportKeys.has(itemDate) || (start && itemDate === key)
  })
  const activityRows = activities.filter(item => keyOf(item.date) === key)
  const income = reports.reduce((sum, report) => sum + Number(report.totalIncome || 0), 0)
  const expenditure = reports.reduce((sum, report) => sum + Number(report.totalExpenditure || 0), 0)
  return {
    date: start,
    reports: reports.length,
    attendance: attendanceRows.reduce((sum, item) => sum + attendanceTotalFor(item), 0),
    activities: reports.reduce((sum, report) => sum + rowsFromJson(report.numerical).reduce((n, row) => n + numberFromRow(row, ['adult', 'adults']) + numberFromRow(row, ['children', 'child']) + numberFromRow(row, ['visitor', 'visitors']), 0), 0) || activityRows.length,
    income,
    expenditure,
    balance: income - expenditure,
  }
}

function formatPeriodDate(value, mode) {
  const date = value instanceof Date ? value : parseDate(value)
  if (!date) return '—'
  if (mode === 'year') return date.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
  return date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function attendanceTotalFor(item) {
  return ['childrenMale', 'childrenFemale', 'teenagersMale', 'teenagersFemale', 'youthMale', 'youthFemale', 'adultsMale', 'adultsFemale']
    .reduce((sum, key) => sum + Number(item[key] || 0), 0)
}

function ReportSection({ eyebrow, title, description, action, children }) {
  return <section className="card full report-section">
    <div className="card-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p className="card-subtitle">{description}</p>
      </div>
      {action && <button className="secondary small-button" onClick={action}>Open record</button>}
    </div>
    {children}
  </section>
}

function SummaryTable({ headers, rows, totalRow }) {
  return <div className="table-wrap report-table"><table>
    <thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
    <tbody>
      {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={cellIndex === 0 ? 'label-cell' : ''}>{cell}</td>)}</tr>)}
      {totalRow && <tr className="summary-total">{totalRow.map((cell, index) => <td key={index}>{cell}</td>)}</tr>}
    </tbody>
  </table></div>
}

function MiniTable({ title, headers, rows, empty = 'No records were saved in this period.' }) {
  return <section className="report-mini-table">
    <h3>{title}</h3>
    <div className="table-wrap"><table><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>
      {rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={cellIndex === 0 ? 'label-cell' : ''}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>{empty}</td></tr>}
    </tbody></table></div>
  </section>
}

function PeriodBreakdown({ title, headers, rows }) {
  return <MiniTable title={title} headers={headers} rows={rows} />
}

function Metric({ label, value }) {
  return <div className="finance-metric"><small>{label}</small><strong>{value}</strong></div>
}

function DailyReview({ review, close }) {
  const { type, item } = review
  const date = type === 'finance' ? item.reportDate : type === 'activity' ? item.date : item.activity?.date
  return <div className="backdrop" onMouseDown={close}>
    <div className="modal report-review-modal" onMouseDown={event => event.stopPropagation()}>
      <div className="modal-head">
        <div><span className="eyebrow">Record</span><h2>{type[0].toUpperCase() + type.slice(1)} · {displayDate(date)}</h2></div>
        <button className="close" onClick={close}>×</button>
      </div>
      {type === 'attendance' && <div className="review-detail-list">
        {[
          ['Service', item.activity?.name || 'Service'],
          ['Children male', item.childrenMale], ['Children female', item.childrenFemale],
          ['Teenagers male', item.teenagersMale], ['Teenagers female', item.teenagersFemale],
          ['Youth male', item.youthMale], ['Youth female', item.youthFemale],
          ['Adults male', item.adultsMale], ['Adults female', item.adultsFemale],
        ].map(([label, value]) => <Detail key={label} label={label} value={typeof value === 'number' ? formatNumber(value) : value} />)}
      </div>}
      {type === 'activity' && <div className="review-detail-list"><Detail label="Activity" value={item.name} /><Detail label="Type" value={item.type || 'Activity'} /><Detail label="Recorded by" value={item.recordedBy?.name || 'Unknown'} /></div>}
      {type === 'finance' && <div className="review-finance">
        <div className="review-total-grid"><Detail label="Money in" value={money(item.totalIncome)} /><Detail label="Money out" value={money(item.totalExpenditure)} /><Detail label="Balance" value={money(item.balance)} /></div>
        <h3>Money in details</h3>{rowsFromJson(item.income).map((row, index) => <p key={index}><span>{row.name || 'Other income'}</span><b>{money(row.amount)}</b></p>)}
        <h3>Money out details</h3>{rowsFromJson(item.expenditure).map((row, index) => <p key={index}><span>{row.name || 'Other expenditure'}</span><b>{money(row.amount)}</b></p>)}
      </div>}
      <div className="record-actions"><button className="secondary" onClick={() => window.print()}>Print / PDF</button><button className="primary" onClick={close}>Done</button></div>
    </div>
  </div>
}

function Detail({ label, value }) {
  return <div className="detail-item"><small>{label}</small><b>{value}</b></div>
}

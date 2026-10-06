import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { money, NUMERICAL_ROWS, INCOME_ROWS, EXPENDITURE_ROWS } from './weeklyReportConfig'
import './ReportsPage.css'

const pad = value => String(value).padStart(2, '0')
const todayKey = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const map = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
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

function weekOfMonth(value) {
  const date = parseDate(value)
  if (!date) return 0
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  return Math.floor((date.getDate() + first.getDay() - 1) / 7) + 1
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

export default function ReportsPage({ user, refreshKey = 0, onEdit, onEditFinance, onEditActivity, onEditAttendance, onOpenRecord }) {
  const [reports, setReports] = useState([])
  const [activities, setActivities] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('week')
  const [today, setToday] = useState(() => todayKey())
  const [anchor, setAnchor] = useState(() => todayKey())
  const [review, setReview] = useState(null)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = todayKey()
      setToday(previous => previous === next ? previous : next)
    }, 60000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    setAnchor(previous => previous === todayKey(new Date(Date.now() - 86400000)) ? today : previous)
  }, [today])
  const [searchType, setSearchType] = useState('')
  const [searchYear, setSearchYear] = useState('')
  const [searchMonth, setSearchMonth] = useState('')
  const [searchWeek, setSearchWeek] = useState('')
  const [searchDay, setSearchDay] = useState('')
  const [searchPeriod, setSearchPeriod] = useState(null)

  const canEditOperational = ['ADMIN', 'SECRETARY', 'PASTOR', 'STAFF'].includes(user?.role)

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

  const searchYears = useMemo(() => {
    const years = new Set()
    reports.forEach(item => {
      const date = parseDate(item.reportDate)
      if (date) years.add(date.getFullYear())
    })
    attendance.forEach(item => {
      const date = parseDate(item.activity?.date || item.date || item.recordDate)
      if (date) years.add(date.getFullYear())
    })
    activities.forEach(item => {
      const date = parseDate(item.date)
      if (date) years.add(date.getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [reports, attendance, activities])

  const searchWeeks = useMemo(() => {
    if (!searchYear || !searchMonth) return [1, 2, 3, 4, 5, 6]
    const days = new Date(Number(searchYear), Number(searchMonth), 0).getDate()
    const firstDay = new Date(Number(searchYear), Number(searchMonth) - 1, 1).getDay()
    const count = Math.ceil((days + firstDay) / 7)
    return Array.from({ length: count }, (_, index) => index + 1)
  }, [searchYear, searchMonth])

  const searchDays = useMemo(() => {
    if (!searchYear || !searchMonth) return Array.from({ length: 31 }, (_, index) => index + 1)
    const days = new Date(Number(searchYear), Number(searchMonth), 0).getDate()
    return Array.from({ length: days }, (_, index) => index + 1)
  }, [searchYear, searchMonth])

  const searchResults = useMemo(() => {
    const matches = (dateValue, type) => {
      const date = parseDate(dateValue)
      if (!date) return false
      if (searchType && type !== searchType) return false
      if (searchYear && date.getFullYear() !== Number(searchYear)) return false
      if (searchMonth && date.getMonth() + 1 !== Number(searchMonth)) return false
      if (searchDay && date.getDate() !== Number(searchDay)) return false
      if (searchWeek && weekOfMonth(dateValue) !== Number(searchWeek)) return false
      return true
    }

    const results = []

    reports.forEach(report => {
      const date = report.reportDate
      const incomeNames = rowsFromJson(report.income).map(row => row.name || row.category).filter(Boolean)
      const expenditureNames = rowsFromJson(report.expenditure).map(row => row.name || row.category).filter(Boolean)
      const activityNames = rowsFromJson(report.numerical).map(row => row.service || row.name).filter(Boolean)
      if (matches(date, 'Finance')) {
        results.push({
          type: 'Finance',
          date,
          recordId: report.id,
          title: 'Finance record',
          detail: `${incomeNames.length} income categories · ${expenditureNames.length} expenditure categories · ${money(report.totalIncome || 0)} in · ${money(report.totalExpenditure || 0)} out`,
        })
      }
      if (matches(date, 'Activities')) {
        results.push({
          type: 'Activities',
          date,
          recordId: report.id,
          title: 'Weekly activities',
          detail: activityNames.length ? activityNames.join(' · ') : 'No activity rows saved',
        })
      }
    })

    attendance.forEach(item => {
      const date = item.activity?.date || item.date || item.recordDate
      const service = item.activity?.name || item.service || 'Attendance record'
      if (matches(date, 'Attendance')) {
        results.push({
          type: 'Attendance',
          date,
          recordId: item.id,
          title: service,
          detail: `${formatNumber(attendanceTotalFor(item))} total attendance`,
        })
      }
    })

    return results.sort((a, b) => keyOf(b.date).localeCompare(keyOf(a.date)))
  }, [reports, attendance, searchType, searchYear, searchMonth, searchWeek, searchDay])

  const clearSearch = () => {
    setSearchPeriod(null)
    setSearchType('')
    setSearchYear('')
    setSearchMonth('')
    setSearchWeek('')
    setSearchDay('')
  }

  const openSearchPeriod = result => {
    const year = Number(searchYear || parseDate(result.date)?.getFullYear())
    const month = Number(searchMonth)
    let start
    let end
    let label
    let selectedMode = 'week'
    let selectedAnchor = keyOf(result.date)

    if (searchWeek && year && month) {
      const first = new Date(year, month - 1, 1)
      const weekStart = new Date(year, month - 1, 1 - first.getDay() + (Number(searchWeek) - 1) * 7)
      start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      label = `Week ${searchWeek} · ${first.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}`
      selectedAnchor = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
    } else if (searchMonth && year) {
      start = new Date(year, month - 1, 1)
      end = new Date(year, month, 0, 23, 59, 59, 999)
      label = start.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
      selectedMode = 'month'
      selectedAnchor = `${year}-${pad(month)}-01`
    } else if (searchYear) {
      start = new Date(year, 0, 1)
      end = new Date(year, 11, 31, 23, 59, 59, 999)
      label = `Calendar year ${year}`
      selectedMode = 'year'
      selectedAnchor = `${year}-01-01`
    } else {
      start = startOfWeek(result.date)
      end = endOfWeek(result.date)
      label = `Week of ${displayDate(start)}`
    }

    setMode(selectedMode)
    setAnchor(selectedAnchor)
    setSearchPeriod({ start, end, label, type: result.type })
    requestAnimationFrame(() => document.querySelector('.report-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const range = useMemo(() => {
    if (searchPeriod) return { start: searchPeriod.start, end: searchPeriod.end }
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
  }, [mode, anchor, searchPeriod])

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
    const total = selectedAttendance.reduce((sum, item) => sum + attendanceTotalFor(item), 0)
    return {
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
      .sort((a, b) => {
        const ai = NUMERICAL_ROWS.indexOf(a.label)
        const bi = NUMERICAL_ROWS.indexOf(b.label)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
      .map(row => ({
        label: row.label,
        averageAdult: roundAverage(average(row.adults, denominator)),
        averageChildren: roundAverage(average(row.children, denominator)),
        averageVisitors: roundAverage(average(row.visitors, denominator)),
        averageTotal: roundAverage(average(row.adults + row.children + row.visitors, denominator)),
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
      averageVisitors: roundAverage(average(
        Array.from(categoryMap.values()).reduce((sum, row) => sum + row.visitors, 0),
        denominator,
      )),
      averageTotal: roundAverage(average(overallTotal, denominator)),
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
      averageIncome: roundAverage(average(income, selectedReports.length)),
      averageExpenditure: roundAverage(average(expenditure, selectedReports.length)),
      averageBalance: roundAverage(average(income - expenditure, selectedReports.length)),
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
      : [{ date: range.start, reports: 0, attendance: 0, activities: 0 }]
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

    <section className="card full record-search-card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Record search</span>
          <h2>Search saved records</h2>
          <p className="card-subtitle">Choose a record type, then narrow it down by year, month, week, or day. The saved date remains the source of truth.</p>
        </div>
        {(searchType || searchYear || searchMonth || searchWeek || searchDay) && <button className="secondary small-button" type="button" onClick={clearSearch}>Reset filters</button>}
      </div>

      <form className="record-search-filters" onSubmit={e => e.preventDefault()}>
        <label className="record-search-primary-filter">
          <span>Record type</span>
          <select value={searchType} onChange={e => setSearchType(e.target.value)} aria-label="Choose record type">
            <option value="">All records</option>
            <option value="Activities">Activities</option>
            <option value="Finance">Finance</option>
            <option value="Attendance">Attendance</option>
          </select>
        </label>
        <label>
          Year
          <select value={searchYear} onChange={e => { setSearchYear(e.target.value); setSearchWeek(''); setSearchDay('') }}>
            <option value="">Any year</option>
            {searchYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          Month
          <select value={searchMonth} onChange={e => { setSearchMonth(e.target.value); setSearchWeek(''); setSearchDay('') }}>
            <option value="">Any month</option>
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index, 1).toLocaleDateString('en-NG', { month: 'long' })}</option>)}
          </select>
        </label>
        <label>
          Week
          <select value={searchWeek} onChange={e => setSearchWeek(e.target.value)}>
            <option value="">Any week</option>
            {searchWeeks.map(week => <option key={week} value={week}>Week {week}</option>)}
          </select>
        </label>
        <label>
          Day
          <select value={searchDay} onChange={e => setSearchDay(e.target.value)}>
            <option value="">Any day</option>
            {searchDays.map(day => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
        <button className="primary search-submit" type="submit">Find records</button>
      </form>

      <div className="search-results-head">
        <strong>{formatNumber(searchResults.length)} result{searchResults.length === 1 ? '' : 's'}</strong>
        <span>{searchType || 'All records'} · {searchYear || 'Any year'} · {searchMonth ? new Date(2000, Number(searchMonth) - 1, 1).toLocaleDateString('en-NG', { month: 'long' }) : 'Any month'} · {searchWeek ? `Week ${searchWeek}` : 'Any week'} · {searchDay ? `Day ${searchDay}` : 'Any day'}</span>
      </div>

      {searchResults.length > 0 ? (
        <div className="record-search-results">
          {searchResults.map((result, index) => (
            <button type="button" className="record-search-result" key={`${result.type}-${keyOf(result.date)}-${index}`} onClick={() => openSearchPeriod(result)}>
              <div>
                <span className="record-search-type">{result.type}</span>
                <h3>{result.title}</h3>
                <p>{result.detail}</p>
              </div>
              <time dateTime={keyOf(result.date)}>{displayDate(result.date)}</time>
            </button>
          ))}
        </div>
      ) : (
        <div className="record-search-empty">
          <strong>No saved record matches this search.</strong>
          <span>Try changing the record type, year, month, week, or day.</span>
        </div>
      )}
    </section>

    <section className="card full report-controls">
      <div className="report-period-tabs" role="tablist" aria-label="Report period">
        {['week', 'month', 'year'].map(item => <button key={item} type="button" className={mode === item ? 'active' : ''} onClick={() => { setSearchPeriod(null); setMode(item) }}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
      <label>
        {mode === 'week' ? 'Choose a date for this week' : mode === 'month' ? 'Choose a month' : 'Choose a reporting year (July–June)'}
        <input type={mode === 'year' ? 'number' : mode === 'month' ? 'month' : 'date'} value={mode === 'year' ? String(parseDate(anchor)?.getFullYear() || new Date().getFullYear()) : mode === 'month' ? keyOf(anchor).slice(0, 7) : anchor} onChange={e => {
          const value = e.target.value
          setSearchPeriod(null)
          setAnchor(mode === 'year' ? `${value}-07-01` : mode === 'month' ? `${value}-01` : value)
        }} />
      </label>
      <div className="period-summary">
        <span className="eyebrow">Selected period</span>
        <strong>{searchPeriod?.label || periodLabel(mode, anchor)}</strong>
        {searchPeriod && <small>Average view · {searchPeriod.type} search · selected date range</small>}
        {mode === 'year' && !searchPeriod && <small>July {parseDate(anchor)?.getFullYear() || new Date().getFullYear()} through June {(parseDate(anchor)?.getFullYear() || new Date().getFullYear()) + 1}</small>}
        <small>{selectedReports.length} official weekly report{selectedReports.length === 1 ? '' : 's'} · {selectedAttendance.length} attendance record{selectedAttendance.length === 1 ? '' : 's'}</small>
        {searchPeriod && <button type="button" className="secondary small-button" onClick={() => setSearchPeriod(null)}>Clear selected search period</button>}
      </div>
    </section>

    {error && <div className="toast toast-error" role="alert">{error}</div>}
    {!loading && searchPeriod && selectedReports.length === 0 && selectedAttendance.length === 0 && <div className="record-search-empty"><strong>No records found for {searchPeriod.label}.</strong><span>There is no saved data in this period to calculate an average from.</span></div>}
    {loading ? <section className="card full"><p>Loading reports…</p></section> : <>
      <ReportSection title="Attendance" eyebrow="Attendance summary" description="Attendance is shown as the saved total for the selected period, without age or gender breakdowns." action={canEditOperational ? () => onEditAttendance?.() : null}>
        <div className="finance-total-grid">
          <Metric label="Total attendance" value={formatNumber(attendanceSummary.total)} />
          <Metric label="Average attendance" value={formatNumber(attendanceSummary.average, Number.isInteger(attendanceSummary.average) ? 0 : 2)} />
          <Metric label="Saved records" value={formatNumber(attendanceSummary.recordCount)} />
        </div>
      </ReportSection>

      <ReportSection title="Activities" eyebrow="Weekly activity report" description="Activities are calculated independently from attendance using the Adults, Children and Visitors columns in each saved weekly report." action={canEditOperational ? () => onEditActivity?.() : null}>
        <SummaryTable headers={['Category', 'Avg. adults', 'Avg. children', 'Avg. visitors', 'Avg. total']} rows={activitySummary.rows.map(row => [
          row.label,
          formatNumber(row.averageAdult, Number.isInteger(row.averageAdult) ? 0 : 2),
          formatNumber(row.averageChildren, Number.isInteger(row.averageChildren) ? 0 : 2),
          formatNumber(row.averageVisitors, Number.isInteger(row.averageVisitors) ? 0 : 2),
          formatNumber(row.averageTotal, Number.isInteger(row.averageTotal) ? 0 : 2),
        ])} totalRow={['Overall activity average', formatNumber(activitySummary.averageAdult, Number.isInteger(activitySummary.averageAdult) ? 0 : 2), formatNumber(activitySummary.averageChildren, Number.isInteger(activitySummary.averageChildren) ? 0 : 2), formatNumber(activitySummary.averageVisitors, Number.isInteger(activitySummary.averageVisitors) ? 0 : 2), formatNumber(activitySummary.averageTotal, Number.isInteger(activitySummary.averageTotal) ? 0 : 2)]} />
        <div className="report-subtable-grid">
          <MiniTable title="Activity records" headers={['Measure', 'Value']} rows={[
            ['Weekly reports', formatNumber(activitySummary.reports)],
            ['Service/activity rows', formatNumber(activitySummary.serviceRows)],
            ['Decisions', formatNumber(activitySummary.decisions)],
            ['Water baptism', formatNumber(activitySummary.waterBaptism)],
          ]} />
          <MiniTable title={mode === 'year' ? 'Monthly activity/attendance totals' : 'Records inside this period'} rows={periodRows.map(row => [formatPeriodDate(row.date, mode), formatNumber(row.activities), formatNumber(row.attendance)])} headers={['Period', 'Activity', 'Attendance']} />
        </div>
      </ReportSection>

      <ReportSection title="Finance" eyebrow="Finance categories" description="Categories use the same names and the same order as the Finance page." action={onEditFinance || onEdit ? () => (onEditFinance || onEdit)?.() : null}>
        <div className="finance-total-grid">
          <Metric label="Average money in / report" value={money(financeSummary.averageIncome)} />
          <Metric label="Average money out / report" value={money(financeSummary.averageExpenditure)} />
          <Metric label="Average balance / report" value={money(financeSummary.averageBalance)} />
          <Metric label="Finance reports included" value={formatNumber(financeSummary.records)} />
        </div>
        <div className="report-subtable-grid">
          <MiniTable title="INCOME" headers={['S/N', 'INCOME', 'AMOUNT']} rows={INCOME_ROWS.filter(Boolean).map((name, index) => {
            const row = financeSummary.categories.find(item => item.category === name)
            return [index + 1, name, money(row?.income || 0)]
          })} empty="No finance income categories were saved in this period." />
          <MiniTable title="EXPENDITURE" headers={['S/N', 'EXPENDITURE', 'AMOUNT']} rows={EXPENDITURE_ROWS.filter(Boolean).map((name, index) => {
            const row = financeSummary.categories.find(item => item.category === name)
            return [index + 1, name, money(row?.expenditure || 0)]
          })} empty="No finance expenditure categories were saved in this period." />
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
            <thead><tr><th>Period</th><th>Reports</th><th>Attendance</th><th>Activities</th></tr></thead>
            <tbody>{periodRows.map((row, index) => <tr key={`${keyOf(row.date)}-${index}`}><td><b>{formatPeriodDate(row.date, mode)}</b></td><td>{formatNumber(row.reports)}</td><td>{formatNumber(row.attendance)}</td><td>{formatNumber(row.activities)}</td></tr>)}</tbody>
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
  return {
    date: start,
    reports: reports.length,
    attendance: attendanceRows.reduce((sum, item) => sum + attendanceTotalFor(item), 0),
    activities: reports.reduce((sum, report) => sum + rowsFromJson(report.numerical).reduce((n, row) => n + numberFromRow(row, ['adult', 'adults']) + numberFromRow(row, ['children', 'child']) + numberFromRow(row, ['visitor', 'visitors']), 0), 0) || activityRows.length,
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
        <Detail label="Service" value={item.activity?.name || 'Service'} />
        <Detail label="Total attendance" value={formatNumber(attendanceTotalFor(item))} />
      </div>}
      {type === 'activity' && <div className="review-detail-list"><Detail label="Activity" value={item.name} /><Detail label="Type" value={item.type || 'Activity'} /><Detail label="Recorded by" value={item.recordedBy?.name || 'Unknown'} /></div>}
      {type === 'finance' && <div className="review-finance">
        <h3>Finance categories</h3>{rowsFromJson(item.income).map((row, index) => <p key={index}><span>{row.name || 'Other income'}</span><b>{money(row.amount)}</b></p>)}
        <h3>Finance categories — money out</h3>{rowsFromJson(item.expenditure).map((row, index) => <p key={index}><span>{row.name || 'Other expenditure'}</span><b>{money(row.amount)}</b></p>)}
      </div>}
      <div className="record-actions"><button className="secondary" onClick={() => window.print()}>Print / PDF</button><button className="primary" onClick={close}>Done</button></div>
    </div>
  </div>
}

function Detail({ label, value }) {
  return <div className="detail-item"><small>{label}</small><b>{value}</b></div>
}

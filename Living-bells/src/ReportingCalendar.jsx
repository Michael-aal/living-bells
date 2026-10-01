import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import './ReportingCalendar.css'

const monthName = value => new Date(Date.UTC(2026, Number(value) - 1, 1)).toLocaleDateString('en-NG', { month: 'long', timeZone: 'UTC' })
const dateLabel = value => new Date(String(value).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function daysForWeek(start) {
  const base = new Date(String(start).slice(0, 10) + 'T12:00:00Z')
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + index)
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'UTC' }), day: d.getUTCDate(), month: d.toLocaleDateString('en-NG', { month: 'short', timeZone: 'UTC' }) }
  })
}

export default function ReportingCalendar({ user, current }) {
  const [months, setMonths] = useState([])
  const [year, setYear] = useState(current?.month?.year || new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ month: current?.month?.month || new Date().getMonth() + 1, weekNumber: 1, startDate: '', endDate: '' })
  const isAdmin = user?.role === 'ADMIN'

  async function load() {
    try {
      setLoading(true)
      setError('')
      const data = await api.reportingMonths(year)
      setMonths(data || [])
    } catch (e) {
      setError(e.message || 'Could not load reporting calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [year])

  function setField(key, value) {
    setForm(currentForm => ({ ...currentForm, [key]: value }))
  }

  async function createWeek() {
    if (!isAdmin) return
    try {
      setError('')
      setNotice('')
      const data = await api.createReportingWeek({
        year: Number(year),
        month: Number(form.month),
        weekNumber: Number(form.weekNumber),
        startDate: form.startDate,
        endDate: form.endDate,
      })
      setMonths(current => {
        const without = current.filter(item => item.id !== data.id)
        return [...without, data].sort((a, b) => a.month - b.month)
      })
      setNotice('Reporting week saved.')
      setForm(currentForm => ({ ...currentForm, weekNumber: Math.min(5, Number(currentForm.weekNumber) + 1), startDate: '', endDate: '' }))
    } catch (e) {
      setError(e.message || 'Could not save reporting week')
    }
  }

  const currentMonth = useMemo(() => months.find(item => Number(item.month) === Number(form.month)), [months, form.month])

  return <div className="reporting-calendar">
    <section className="card full reporting-hero">
      <div>
        <span className="eyebrow">Reporting calendar</span>
        <h2>Custom seven-day reporting periods</h2>
        <p className="card-subtitle">The administrator defines each seven-day range. Living Bells then finds the current week automatically from today's date.</p>
      </div>
      {current?.week ? <div className="current-period"><small>Current reporting period</small><b>{current.month ? monthName(current.month.month) + ' ' + current.month.year : '—'} · Week {current.week.weekNumber}</b><span>{current.day}, {dateLabel(current.date)}</span></div> : <div className="current-period"><small>Current reporting period</small><b>No week assigned yet</b><span>Define a week containing today's date.</span></div>}
    </section>

    {error && <div className="toast toast-error" role="alert">{error}</div>}
    {notice && <div className="toast" role="status">{notice}</div>}

    {isAdmin && <section className="card full">
      <div className="card-head"><div><span className="eyebrow">Administration</span><h2>Create a reporting week</h2><p className="card-subtitle">Each range must contain exactly seven consecutive calendar days.</p></div></div>
      <div className="calendar-form-grid">
        <label>Year<input type="number" min="2000" max="2200" value={year} onChange={e => setYear(e.target.value)} /></label>
        <label>Month<select value={form.month} onChange={e => setField('month', e.target.value)}>{Array.from({ length: 12 }, (_, i) => i + 1).map(value => <option key={value} value={value}>{monthName(value)}</option>)}</select></label>
        <label>Week<select value={form.weekNumber} onChange={e => setField('weekNumber', e.target.value)}>{[1,2,3,4,5].map(value => <option key={value} value={value}>Week {value}</option>)}</select></label>
        <label>Start date<input type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} /></label>
        <label>End date<input type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)} /></label>
        <button className="primary" type="button" disabled={!form.startDate || !form.endDate} onClick={createWeek}>Save week</button>
      </div>
    </section>}

    <section className="card full">
      <div className="card-head">
        <div><span className="eyebrow">Saved periods</span><h2>Reporting weeks</h2></div>
        <label className="year-picker">Year<input type="number" value={year} onChange={e => setYear(e.target.value)} /></label>
      </div>
      {loading ? <p>Loading reporting periods…</p> : !months.length ? <p>No reporting periods have been configured for {year}.</p> :
        <div className="month-list">{months.map(month => <MonthCard key={month.id} month={month} />)}</div>}
    </section>
  </div>
}

function MonthCard({ month }) {
  return <article className="reporting-month">
    <div className="month-heading"><div><span className="eyebrow">{monthName(month.month)}</span><h3>{month.year}</h3></div><span className="pill">{month.weeks.length} week{month.weeks.length === 1 ? '' : 's'} saved</span></div>
    <div className="week-list">
      {month.weeks.map(week => <details className="reporting-week" key={week.id}>
        <summary><span><b>Week {week.weekNumber}</b><small>{dateLabel(week.startDate)} → {dateLabel(week.endDate)}</small></span><strong>{week.status}</strong></summary>
        <div className="week-days">{daysForWeek(week.startDate).map(day => <div className="week-day" key={day.date}><b>{day.label}</b><span>{day.day} {day.month}</span></div>)}</div>
      </details>)}
    </div>
  </article>
}

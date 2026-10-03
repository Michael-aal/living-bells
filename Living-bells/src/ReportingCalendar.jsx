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
    return {
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'UTC' }),
      day: d.getUTCDate(),
      month: d.toLocaleDateString('en-NG', { month: 'short', timeZone: 'UTC' }),
    }
  })
}

function addDays(value, amount) {
  if (!value) return ''
  const d = new Date(String(value).slice(0, 10) + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + amount)
  return d.toISOString().slice(0, 10)
}

function emptyForm(year, month) {
  return {
    year: Number(year),
    month: Number(month),
    weekNumber: 1,
    startDate: '',
    endDate: '',
  }
}

export default function ReportingCalendar({ user, current }) {
  const currentYear = Number(current?.month?.year || new Date().getFullYear())
  const currentMonth = Number(current?.month?.month || new Date().getMonth() + 1)
  const [months, setMonths] = useState([])
  const [year, setYear] = useState(currentYear)
  const [form, setForm] = useState(emptyForm(currentYear, currentMonth))
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [highlightedWeekId, setHighlightedWeekId] = useState(null)
  const isAdmin = user?.role === 'ADMIN'

  async function load() {
    try {
      setLoading(true)
      setError('')
      const data = await api.reportingMonths(year)
      setMonths(data || [])
      return data || []
    } catch (e) {
      setError(e.message || 'Could not load calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [year])

  function setField(key, value) {
    setForm(currentForm => {
      const next = { ...currentForm, [key]: value }

      if (key === 'startDate' && value && !editingId) {
        next.endDate = addDays(value, 6)
        const end = new Date(next.endDate + 'T12:00:00Z')
        next.year = end.getUTCFullYear()
        next.month = end.getUTCMonth() + 1
        setYear(end.getUTCFullYear())
      }

      if (key === 'endDate' && value) {
        const end = new Date(value + 'T12:00:00Z')
        if (!Number.isNaN(end.getTime())) {
          next.year = end.getUTCFullYear()
          next.month = end.getUTCMonth() + 1
          setYear(end.getUTCFullYear())
        }
      }

      return next
    })
  }

  function startEditing(month, week) {
    setEditingId(week.id)
    setForm({
      year: Number(month.year),
      month: Number(month.month),
      weekNumber: Number(week.weekNumber),
      startDate: week.startDate,
      endDate: week.endDate,
    })
    setNotice('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditing() {
    setEditingId(null)
    setForm(emptyForm(year, currentMonth))
  }

  async function saveWeek() {
    if (!isAdmin || saving) return
    try {
      setSaving(true)
      setError('')
      setNotice('')
      setHighlightedWeekId(null)

      const payload = {
        year: Number(form.year),
        month: Number(form.month),
        weekNumber: Number(form.weekNumber),
        startDate: form.startDate,
        endDate: form.endDate,
      }

      if (editingId) {
        await api.updateReportingWeek(editingId, payload)
        setNotice('Calendar week updated.')
      } else {
        await api.createReportingWeek(payload)
        setNotice('Calendar week saved.')
      }

      setEditingId(null)
      setForm(currentForm => ({
        ...currentForm,
        weekNumber: Math.min(5, Number(currentForm.weekNumber) + 1),
        startDate: '',
        endDate: '',
      }))
      await load()
    } catch (e) {
      if (!editingId && e.message === 'That reporting week already exists') {
        const refreshed = await load()
        const existing = (refreshed || [])
          .flatMap(month => (month.weeks || []).map(week => ({ ...week, month })))
          .find(week => Number(week.month.year) === Number(form.year)
            && Number(week.month.month) === Number(form.month)
            && Number(week.weekNumber) === Number(form.weekNumber))

        if (existing) {
          setHighlightedWeekId(existing.id)
          setNotice('That reporting week is already saved. The existing week is highlighted below.')
          return
        }
      }
      setError(e.message || 'Could not save calendar week')
    } finally {
      setSaving(false)
    }
  }

  async function deleteWeek(week) {
    if (!isAdmin) return
    if (!window.confirm('Delete this calendar week? This is only allowed when the week has no recorded data.')) return

    try {
      setError('')
      setNotice('')
      await api.deleteReportingWeek(week.id)
      if (editingId === week.id) cancelEditing()
      setNotice('Calendar week deleted.')
      await load()
    } catch (e) {
      setError(e.message || 'Could not delete calendar week')
    }
  }

  const selectedMonth = useMemo(
    () => months.find(item => Number(item.month) === Number(form.month)),
    [months, form.month]
  )

  return <div className="calendar-page">
    <section className="card full calendar-hero">
      <div className="calendar-hero-copy">
        <span className="eyebrow">Calendar settings</span>
        <h2>Build the church reporting calendar</h2>
        <p className="card-subtitle">Set each reporting week as one exact seven-day period. The system uses these saved ranges to determine the current day and week automatically.</p>
      </div>
      <div className="calendar-current">
        <small>Today</small>
        <b>{current?.day || 'Calendar not configured'}</b>
        <strong>{current?.date ? dateLabel(current.date) : 'No saved week contains today'}</strong>
        {current?.week && <span>{monthName(current.month.month)} {current.month.year} · Week {current.week.weekNumber}</span>}
      </div>
    </section>

    {error && <div className="calendar-alert error" role="alert">{error}</div>}
    {notice && <div className="calendar-alert success" role="status">{notice}</div>}

    {isAdmin ? <section className="card full calendar-builder">
      <div className="section-title">
        <div>
          <span className="eyebrow">{editingId ? 'Edit calendar week' : 'Calendar setup'}</span>
          <h2>{editingId ? 'Update a seven-day range' : 'Set a reporting week'}</h2>
          <p className="card-subtitle">Choose the month and week number, then define the exact seven dates for that week.</p>
        </div>
        {editingId && <button type="button" className="secondary" onClick={cancelEditing}>Cancel edit</button>}
      </div>

      <div className="calendar-builder-grid">
        <label>
          <span>Year</span>
          <input type="number" min="2000" max="2200" value={form.year} onChange={e => { setField('year', e.target.value); setYear(Number(e.target.value) || currentYear) }} />
        </label>
        <label>
          <span>Month</span>
          <select value={form.month} onChange={e => setField('month', Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(value => <option key={value} value={value}>{monthName(value)}</option>)}
          </select>
        </label>
        <label>
          <span>Week</span>
          <select value={form.weekNumber} onChange={e => setField('weekNumber', Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>Week {value}</option>)}
          </select>
        </label>
        <label>
          <span>Start date</span>
          <input type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
        </label>
        <label>
          <span>End date</span>
          <input type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)} />
        </label>
        <div className="calendar-builder-action">
          <button className="primary" type="button" disabled={saving || !form.startDate || !form.endDate} onClick={saveWeek}>
            {saving ? 'Saving…' : editingId ? 'Update week' : 'Save week'}
          </button>
          <small>Exactly 7 consecutive days</small>
        </div>
      </div>

      <div className="calendar-rule">
        <span>Example</span>
        <b>October · Week 1</b>
        <em>Oct 4 → Oct 10</em>
        <small>If a seven-day week crosses into a new month, the new month owns that week. For example, Oct 31 → Nov 6 is assigned to November.</small>
      </div>
    </section> : <section className="card full calendar-readonly">
      <span className="eyebrow">Calendar</span>
      <h2>Saved church time periods</h2>
      <p className="card-subtitle">Only administrators can change calendar settings. Your records automatically use the saved week that contains the recording date.</p>
    </section>}

    <section className="card full">
      <div className="section-title">
        <div>
          <span className="eyebrow">Saved calendar</span>
          <h2>{year} calendar</h2>
          <p className="card-subtitle">Every date in a month should be covered by exactly one seven-day week.</p>
        </div>
        <label className="year-picker">
          <span>View year</span>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value) || currentYear)} />
        </label>
      </div>

      {loading ? <p>Loading calendar…</p> : !months.length ? <div className="calendar-empty"><b>No weeks configured yet.</b><span>Start with the setup above. Save Week 1, then continue until the month is fully covered.</span></div> :
        <div className="calendar-month-list">
          {months.map(month => <MonthCard key={month.id} month={month} isAdmin={isAdmin} highlightedWeekId={highlightedWeekId} onEdit={startEditing} onDelete={deleteWeek} />)}
        </div>}
    </section>

    {selectedMonth && <div className="sr-only" aria-live="polite">{selectedMonth.coverage?.coveredDays || 0} of {selectedMonth.coverage?.totalDays || 0} dates covered</div>}
  </div>
}

function MonthCard({ month, isAdmin, highlightedWeekId, onEdit, onDelete }) {
  const coverage = month.coverage || { totalDays: 0, coveredDays: 0, missingDays: 0, complete: false, missingDates: [] }
  const percentage = coverage.totalDays ? Math.round((coverage.coveredDays / coverage.totalDays) * 100) : 0

  return <article className="calendar-month">
    <div className="calendar-month-head">
      <div>
        <span className="eyebrow">{monthName(month.month)}</span>
        <h3>{month.year}</h3>
      </div>
      <div className={coverage.complete ? 'coverage-badge complete' : 'coverage-badge'}>
        <b>{coverage.coveredDays}/{coverage.totalDays}</b>
        <span>{coverage.complete ? 'Complete' : 'Needs setup'}</span>
      </div>
    </div>

    <div className="coverage-track" aria-label={percentage + '% of dates covered'}>
      <span style={{ width: percentage + '%' }} />
    </div>

    {!coverage.complete && coverage.missingDates?.length > 0 && <div className="coverage-warning">
      <b>{coverage.missingDays} date{coverage.missingDays === 1 ? '' : 's'} still uncovered</b>
      <span>{coverage.missingDates.slice(0, 6).map(date => dateLabel(date)).join(' · ')}{coverage.missingDates.length > 6 ? ' · …' : ''}</span>
    </div>}

    <div className="calendar-week-list">
      {month.weeks.map(week => <WeekCard key={week.id} month={month} week={week} isAdmin={isAdmin} highlighted={week.id === highlightedWeekId} onEdit={onEdit} onDelete={onDelete} />)}
    </div>

    {!month.weeks.length && <p className="calendar-empty-inline">No weeks saved for this month.</p>}
  </article>
}

function WeekCard({ month, week, isAdmin, highlighted, onEdit, onDelete }) {
  return <details className={highlighted ? 'calendar-week highlighted' : 'calendar-week'} open={highlighted}>
    <summary>
      <span className="week-title"><b>Week {week.weekNumber}</b><small>{dateLabel(week.startDate)} → {dateLabel(week.endDate)}</small></span>
      <span className="week-summary-actions">
        <em>{week.status}</em>
        {isAdmin && <span className="week-actions" onClick={e => e.preventDefault()}>
          <button type="button" onClick={() => onEdit(month, week)}>Edit</button>
          <button type="button" onClick={() => onDelete(week)}>Delete</button>
        </span>}
      </span>
    </summary>
    <div className="week-days">
      {daysForWeek(week.startDate).map(day => <div className="week-day" key={day.date}>
        <b>{day.label}</b>
        <strong>{day.day}</strong>
        <span>{day.month}</span>
      </div>)}
    </div>
  </details>
}

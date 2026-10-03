import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

function dateKey(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function daysForWeek(week) {
  const base = new Date(String(week.startDate).slice(0, 10) + 'T12:00:00Z')
  const end = String(week.endDate).slice(0, 10)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base)
    date.setUTCDate(base.getUTCDate() + index)
    return {
      date: date.toISOString().slice(0, 10),
      weekday: date.toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'UTC' }),
      day: date.getUTCDate(),
      month: date.toLocaleDateString('en-NG', { month: 'short', timeZone: 'UTC' }),
    }
  }).filter(day => day.date <= end)
}

export default function ReportingWeekPicker({ date, onDateChange }) {
  const selectedDate = String(date || new Date().toISOString()).slice(0, 10)
  const selectedDateObj = new Date(selectedDate + 'T12:00:00Z')
  const selectedYear = selectedDateObj.getUTCFullYear()
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(false)
  const [openWeekId, setOpenWeekId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.reportingMonths(selectedYear)
      .then(data => { if (!cancelled) setMonths(data || []) })
      .catch(() => { if (!cancelled) setMonths([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedYear])

  const allWeeks = useMemo(
    () => months.flatMap(month => (month.weeks || []).map(week => ({ ...week, month }))),
    [months]
  )

  const containingWeek = useMemo(
    () => allWeeks.find(week => {
      const start = String(week.startDate).slice(0, 10)
      const end = String(week.endDate).slice(0, 10)
      return selectedDate >= start && selectedDate <= end
    }) || null,
    [allWeeks, selectedDate]
  )

  const visibleWeeks = useMemo(() => {
    if (containingWeek) {
      return (containingWeek.month.weeks || [])
        .map(week => ({ ...week, month: containingWeek.month }))
        .sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber))
    }
    return allWeeks
      .filter(week => Number(week.month.month) === selectedDateObj.getUTCMonth() + 1)
      .sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber))
  }, [allWeeks, containingWeek, selectedDateObj])

  const currentWeek = useMemo(() => {
    const today = dateKey(new Date())
    return allWeeks.find(week => {
      const start = String(week.startDate).slice(0, 10)
      const end = String(week.endDate).slice(0, 10)
      return today >= start && today <= end
    }) || null
  }, [allWeeks])

  useEffect(() => {
    if (containingWeek) setOpenWeekId(containingWeek.id)
  }, [containingWeek?.id])

  if (loading) return <div className="reporting-week-picker"><small className="reporting-week-loading">Loading saved weeks…</small></div>
  if (!visibleWeeks.length) return <div className="reporting-week-picker"><small className="reporting-week-empty">No saved reporting week covers this date.</small></div>

  return <div className="reporting-week-picker" aria-label="Saved reporting weeks">
    <div className="reporting-week-heading">
      <div>
        <span className="eyebrow">Reporting calendar</span>
        <strong>{containingWeek ? \`\${new Date(Date.UTC(containingWeek.month.year, containingWeek.month.month - 1, 1)).toLocaleDateString('en-NG', { month: 'long', year: 'numeric', timeZone: 'UTC' })} · Week \${containingWeek.weekNumber}\` : 'Select a saved week'}</strong>
      </div>
      {containingWeek && <small>{String(containingWeek.startDate).slice(0, 10)} → {String(containingWeek.endDate).slice(0, 10)}</small>}
    </div>
    <div className="reporting-week-strip" role="tablist" aria-label="Reporting weeks">
      {visibleWeeks.map(week => {
        const selected = containingWeek?.id === week.id
        const current = currentWeek?.id === week.id
        const monthName = new Date(Date.UTC(week.month.year, week.month.month - 1, 1)).toLocaleDateString('en-NG', { month: 'short', timeZone: 'UTC' })
        return <button key={week.id} type="button" role="tab" aria-selected={selected} className={\`reporting-week-tab\${selected ? ' selected' : ''}\${current ? ' current' : ''}\`} onClick={() => {
          setOpenWeekId(week.id)
          if (!selected) onDateChange(String(week.startDate).slice(0, 10))
        }}>
          <span>Week {week.weekNumber}</span>
          <small>{monthName}</small>
          {current && <em>Current</em>}
        </button>
      })}
    </div>
    {containingWeek && openWeekId === containingWeek.id && <div className="reporting-day-strip" aria-label={\`Days in Week \${containingWeek.weekNumber}\`}>
      {daysForWeek(containingWeek).map(day => <button key={day.date} type="button" className={selectedDate === day.date ? 'selected' : ''} onClick={() => onDateChange(day.date)}>
        <span>{day.weekday}</span><strong>{day.day}</strong><small>{day.month}</small>
      </button>)}
    </div>}
  </div>
}

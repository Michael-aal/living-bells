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
      weekday: date.toLocaleDateString('en-NG', {
        weekday: 'short',
        timeZone: 'UTC',
      }),
      day: date.getUTCDate(),
      month: date.toLocaleDateString('en-NG', {
        month: 'short',
        timeZone: 'UTC',
      }),
    }
  }).filter(day => day.date <= end)
}

function monthLabel(month) {
  return new Date(
    Date.UTC(Number(month.year), Number(month.month) - 1, 1)
  ).toLocaleDateString('en-NG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function ReportingWeekPicker({ date, onDateChange }) {
  const selectedDate = String(
    date || new Date().toISOString()
  ).slice(0, 10)

  const selectedDateObj = new Date(selectedDate + 'T12:00:00Z')
  const selectedYear = selectedDateObj.getUTCFullYear()
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(false)
  const [openWeekId, setOpenWeekId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const years = [selectedYear]
    if (selectedDateObj.getUTCMonth() === 11) years.push(selectedYear + 1)

    Promise.all(years.map(year => api.reportingMonths(year)))
      .then(results => {
        if (!cancelled) {
          const merged = results.flatMap(data => data || [])
          const seen = new Set()
          setMonths(
            merged.filter(month => {
              const key = String(month.id)
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
          )
        }
      })
      .catch(() => {
        if (!cancelled) setMonths([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedDateObj.getUTCMonth()])

  const allWeeks = useMemo(
    () =>
      months.flatMap(month =>
        (month.weeks || []).map(week => ({
          ...week,
          month,
        }))
      ),
    [months]
  )

  const containingWeek = useMemo(
    () =>
      allWeeks.find(week => {
        const start = String(week.startDate).slice(0, 10)
        const end = String(week.endDate).slice(0, 10)
        return selectedDate >= start && selectedDate <= end
      }) || null,
    [allWeeks, selectedDate]
  )

  const currentWeek = useMemo(() => {
    const today = dateKey(new Date())

    return (
      allWeeks.find(week => {
        const start = String(week.startDate).slice(0, 10)
        const end = String(week.endDate).slice(0, 10)
        return today >= start && today <= end
      }) || null
    )
  }, [allWeeks])

  const activeWeek = containingWeek || currentWeek

  const visibleWeeks = useMemo(() => {
    if (!activeWeek) return []

    return (activeWeek.month.weeks || [])
      .map(week => ({
        ...week,
        month: activeWeek.month,
      }))
      .sort(
        (a, b) =>
          Number(a.weekNumber) - Number(b.weekNumber)
      )
  }, [activeWeek])

  useEffect(() => {
    if (activeWeek) setOpenWeekId(activeWeek.id)
  }, [activeWeek?.id])

  if (loading) {
    return (
      <div className="reporting-week-picker">
        <small className="reporting-week-loading">
          Loading saved weeks…
        </small>
      </div>
    )
  }

  if (!activeWeek) {
    return (
      <div className="reporting-week-picker">
        <small className="reporting-week-empty">
          No saved reporting week covers this date.
        </small>
      </div>
    )
  }

  return (
    <div
      className="reporting-week-picker"
      aria-label="Saved reporting weeks"
    >
      <div className="reporting-week-heading">
        <div>
          <span className="eyebrow">Reporting calendar</span>
          <strong>
            {monthLabel(activeWeek.month)} · Week {activeWeek.weekNumber}
          </strong>
        </div>

        <small>
          {String(activeWeek.startDate).slice(0, 10)}
          {' → '}
          {String(activeWeek.endDate).slice(0, 10)}
        </small>
      </div>

      <div
        className="reporting-week-strip"
        role="tablist"
        aria-label={`Reporting weeks for ${monthLabel(activeWeek.month)}`}
      >
        {visibleWeeks.map(week => {
          const selected = containingWeek?.id === week.id
          const current = currentWeek?.id === week.id

          return (
            <button
              key={week.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={[
                'reporting-week-tab',
                selected ? 'selected' : '',
                current ? 'current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                setOpenWeekId(week.id)

                if (!selected) {
                  onDateChange(
                    String(week.startDate).slice(0, 10)
                  )
                }
              }}
            >
              <span>Week {week.weekNumber}</span>
              <small>
                {new Date(
                  String(week.startDate).slice(0, 10) + 'T12:00:00Z'
                ).toLocaleDateString('en-NG', {
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </small>
              {current && <em>Current</em>}
            </button>
          )
        })}
      </div>

      {openWeekId === activeWeek.id && (
        <div
          className="reporting-day-strip"
          aria-label={`Days in Week ${activeWeek.weekNumber}`}
        >
          {daysForWeek(activeWeek).map(day => (
            <button
              key={day.date}
              type="button"
              className={selectedDate === day.date ? 'selected' : ''}
              onClick={() => onDateChange(day.date)}
            >
              <span>{day.weekday}</span>
              <strong>{day.day}</strong>
              <small>{day.month}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

function dateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const map = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
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
  const selectedMonthNumber = selectedDateObj.getUTCMonth() + 1
  const [configuredYears, setConfiguredYears] = useState([])
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(false)
  const [openWeekId, setOpenWeekId] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.reportingYears()
      .then(data => {
        if (!cancelled) {
          const years = Array.isArray(data)
            ? [...new Set(data.map(Number).filter(year => Number.isInteger(year) && year > 0))]
                .sort((a, b) => b - a)
            : []
          setConfiguredYears(years)
        }
      })
      .catch(() => {
        if (!cancelled) setConfiguredYears([])
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.reportingMonths(selectedYear)
      .then(data => {
        if (!cancelled) setMonths(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setMonths([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedYear])

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

  const configuredMonths = useMemo(
    () => months.filter(month => (month.weeks || []).length > 0),
    [months]
  )

  const selectedMonthWeeks = useMemo(
    () => allWeeks.filter(week =>
      Number(week.month.year) === selectedYear &&
      Number(week.month.month) === selectedMonthNumber
    ),
    [allWeeks, selectedYear, selectedMonthNumber]
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

  // Only display periods created by the administrator. If the chosen date
  // is outside a configured week, show saved weeks from its configured month.
  const activeWeek = containingWeek || selectedMonthWeeks[0] || null

  const visibleWeeks = useMemo(() => {
    const sourceWeeks = activeWeek?.month?.weeks || selectedMonthWeeks
    return sourceWeeks
      .map(week => ({
        ...week,
        month: activeWeek?.month || months.find(month =>
          Number(month.year) === selectedYear &&
          Number(month.month) === selectedMonthNumber
        ),
      }))
      .filter(week => week.month)
      .sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber))
  }, [activeWeek, selectedMonthWeeks, months, selectedYear, selectedMonthNumber])

  async function navigateToYear(yearValue) {
    const year = Number(yearValue)
    if (!configuredYears.includes(year)) return
    try {
      setLoading(true)
      const yearMonths = await api.reportingMonths(year)
      const availableMonths = (Array.isArray(yearMonths) ? yearMonths : [])
        .filter(month => (month.weeks || []).length > 0)
      const firstWeek = availableMonths[0]?.weeks?.[0]
      if (!firstWeek) return
      onDateChange(String(firstWeek.startDate).slice(0, 10))
    } catch {
      // Keep the current date if the configured calendar cannot be loaded.
    } finally {
      setLoading(false)
    }
  }

  function navigateToMonth(monthValue) {
    const month = configuredMonths.find(item => Number(item.month) === Number(monthValue))
    const firstWeek = month?.weeks?.[0]
    if (firstWeek) onDateChange(String(firstWeek.startDate).slice(0, 10))
  }

  useEffect(() => {
    if (activeWeek) setOpenWeekId(activeWeek.id)
  }, [activeWeek?.id])

  useEffect(() => {
    if (!selectedDate || loading) return
    requestAnimationFrame(() => {
      document.querySelector(`[data-reporting-day="${selectedDate}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    })
  }, [selectedDate, loading, openWeekId])

  if (loading) {
    return (
      <div className="reporting-week-picker">
        <small className="reporting-week-loading">
          Loading saved weeks…
        </small>
      </div>
    )
  }

  return (
    <div
      className="reporting-week-picker"
      aria-label="Saved reporting weeks"
    >
      <div className="reporting-period-navigation">
        <label>
          <span>Reporting year</span>
          <select
            value={configuredYears.includes(selectedYear) ? selectedYear : ''}
            onChange={event => navigateToYear(event.target.value)}
            aria-label="Choose configured reporting year"
            disabled={!configuredYears.length}
          >
            <option value="">Choose year</option>
            {configuredYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          <span>Month</span>
          <select
            value={selectedMonthWeeks.length ? selectedMonthNumber : ''}
            onChange={event => navigateToMonth(event.target.value)}
            aria-label="Choose configured reporting month"
            disabled={!configuredMonths.length}
          >
            <option value="">Choose month</option>
            {configuredMonths.map(month => (
              <option key={month.id} value={month.month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!configuredYears.includes(selectedYear) && (
        <small className="reporting-week-empty">
          Choose a year configured by your administrator to see its reporting weeks.
        </small>
      )}
      {configuredYears.includes(selectedYear) && !configuredMonths.length && (
        <small className="reporting-week-empty">
          No months with reporting weeks are configured for this year.
        </small>
      )}
      {configuredYears.includes(selectedYear) && configuredMonths.length > 0 && !containingWeek && (
        <small className="reporting-week-empty">
          Choose a configured week, then select the day you are reporting for.
        </small>
      )}

      {activeWeek && (
      <>
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
              className={[
                selectedDate === day.date ? 'selected' : '',
                dateKey() === day.date ? 'current' : '',
              ].filter(Boolean).join(' ')}
              data-reporting-day={day.date}
              aria-current={dateKey() === day.date ? 'date' : undefined}
              onClick={() => onDateChange(day.date)}
            >
              <span>{day.weekday}</span>
              <strong>{day.day}</strong>
              <small>{day.month}</small>
            </button>
          ))}
        </div>
      )}
      </>
      )}

      {!activeWeek && (
        <small className="reporting-week-empty">
          No reporting weeks are saved for this month yet.
        </small>
      )}
    </div>
  )
}

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
  const selectedDayNumber = selectedDateObj.getUTCDate()
  const currentDate = dateKey()
  const currentYear = Number(currentDate.slice(0, 4))
  const currentMonth = Number(currentDate.slice(5, 7))
  const [navigationYear, setNavigationYear] = useState(selectedYear)
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

  useEffect(() => {
    setNavigationYear(selectedYear)
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

  // When the selected date is not covered, show the selected month's saved
  // weeks so staff can navigate to a configured historical reporting period.
  const activeWeek =
    containingWeek ||
    (selectedYear === currentYear && selectedMonthNumber === currentMonth ? currentWeek : null) ||
    selectedMonthWeeks[0] ||
    null

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

  function navigateToPeriod(yearValue, monthValue) {
    const year = Number(yearValue)
    const month = Number(monthValue)
    if (!Number.isInteger(year) || year < 1 || year > 9999 ||
        !Number.isInteger(month) || month < 1 || month > 12) return
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const day = Math.min(selectedDayNumber, lastDay)
    onDateChange(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
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
          <input
            type="number"
            inputMode="numeric"
            value={navigationYear}
            onChange={event => setNavigationYear(event.target.value)}
            aria-label="Choose reporting year"
          />
        </label>
        <label>
          <span>Month</span>
          <select
            value={selectedMonthNumber}
            onChange={event => navigateToPeriod(selectedYear, event.target.value)}
            aria-label="Choose reporting month"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map(month => (
              <option key={month} value={month}>
                {new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString('en-NG', { month: 'long', timeZone: 'UTC' })}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          disabled={!Number.isInteger(Number(navigationYear)) || Number(navigationYear) < 1 || Number(navigationYear) > 9999}
          onClick={() => navigateToPeriod(navigationYear, selectedMonthNumber)}
        >
          Go to year
        </button>
      </div>

      {!containingWeek && (
        <small className="reporting-week-empty">
          This date is not inside a saved reporting week. Choose a saved week below, or select another date.
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

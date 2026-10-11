function toUtcDay(value) {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (match) {
      const [, y, m, d] = match
      const date = new Date(0)
      date.setUTCHours(0, 0, 0, 0)
      date.setUTCFullYear(Number(y), Number(m) - 1, Number(d))
      if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null
      return date
    }
  }

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  return date
}

export function validateReportingWeekDates({ year, month, weekNumber, startDate, endDate }) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return 'A valid reporting year is required'
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'A valid reporting month is required'
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 5) return 'Week must be between 1 and 5'

  const start = toUtcDay(startDate)
  const end = toUtcDay(endDate)
  if (!start || !end) return 'A valid start and end date are required'
  if (end.getTime() - start.getTime() !== 6 * 86400000) return 'A reporting week must contain exactly 7 days'

  if (end.getUTCFullYear() !== year || end.getUTCMonth() + 1 !== month) {
    return 'The reporting month must match the month where the reporting week ends'
  }

  return null
}

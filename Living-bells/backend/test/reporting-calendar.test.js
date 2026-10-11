import test from 'node:test'
import assert from 'node:assert/strict'
import { validateReportingWeekDates } from '../src/reporting-calendar.js'

function week(startDate, overrides = {}) {
  const start = new Date(startDate + 'T12:00:00Z')
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    year: end.getUTCFullYear(),
    month: end.getUTCMonth() + 1,
    weekNumber: 1,
    startDate,
    endDate: end.toISOString().slice(0, 10),
    ...overrides,
  }
}

test('accepts historical, current, and future years without a hardcoded year', () => {
  for (const start of ['2001-10-04', '2025-10-04', '2026-10-04', '2030-10-04', '2099-10-04']) {
    assert.equal(validateReportingWeekDates(week(start)), null, start)
  }
})

test('accepts a seven-day range that crosses a month and year boundary', () => {
  assert.equal(validateReportingWeekDates(week('2025-12-29')), null)
})

test('accepts a valid seven-day range during leap year February', () => {
  assert.equal(validateReportingWeekDates(week('2024-02-24')), null)
})

test('rejects a range that is not exactly seven days', () => {
  const range = week('2026-10-04')
  range.endDate = '2026-10-09'
  assert.match(validateReportingWeekDates(range), /exactly 7 days/)
})

test('rejects impossible dates instead of allowing JavaScript date rollover', () => {
  const range = week('2025-02-22')
  range.startDate = '2025-02-30'
  assert.match(validateReportingWeekDates(range), /valid start and end date/)
})

test('requires the selected month and year to match the end date', () => {
  assert.match(validateReportingWeekDates(week('2025-10-04', { year: 2026 })), /month where the reporting week ends/)
})

test('rejects invalid month, year, and week number values', () => {
  assert.match(validateReportingWeekDates(week('2026-10-04', { month: 13 })), /valid reporting month/)
  assert.match(validateReportingWeekDates(week('2026-10-04', { year: 0 })), /valid reporting year/)
  assert.match(validateReportingWeekDates(week('2026-10-04', { weekNumber: 6 })), /between 1 and 5/)
})

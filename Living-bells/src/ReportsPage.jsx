import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { dateLabel, money } from './weeklyReportConfig'
import './ReportsPage.css'

function startOfDay(value) {
  if (!value) return null
  return new Date(value + 'T00:00:00')
}
function sameDay(value, selected) {
  if (!selected) return true
  return String(value).slice(0, 10) === selected
}
function amountMatches(report, amount) {
  if (amount === '') return true
  const target = Number(amount)
  if (!Number.isFinite(target)) return true
  return [report.totalIncome, report.totalExpenditure, report.balance]
    .some(value => Math.abs(Number(value || 0) - target) < 0.005)
}

export default function ReportsPage({ user, onEdit }) {
  const [reports, setReports] = useState([])
  const [expenses, setExpenses] = useState([])
  const [date, setDate] = useState('')
  const [year, setYear] = useState('')
  const [amount, setAmount] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError('')
        const [weekly, legacyExpenses] = await Promise.all([api.weeklyReports(), api.expenses()])
        if (cancelled) return
        setReports(weekly || [])
        setExpenses((legacyExpenses || []).map(item => ({ ...item, amount: Number(item.amount || 0) })))
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => reports.filter(report => {
    const reportDate = String(report.reportDate || '').slice(0, 10)
    return sameDay(reportDate, date)
      && (!year || reportDate.startsWith(year))
      && amountMatches(report, amount)
  }), [reports, date, year, amount])

  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const monthKey = todayKey.slice(0, 7)
  const yearKey = todayKey.slice(0, 4)

  // WeeklyReport is the source of truth for this page because Finance/Activities
  // save the official weekly form into WeeklyReport. Do not mix it with the
  // separate FinancialRecord ledger here: doing so would double-count money
  // that is already represented inside a saved weekly report.
  const financeTotals = useMemo(() => {
    const inFor = key => reports
      .filter(report => {
        const value = String(report.reportDate || '').slice(0, 10)
        return key.length === 10 ? value === key : value.startsWith(key)
      })
      .reduce((sum, report) => sum + Number(report.totalIncome || 0), 0)

    const outFor = key => reports
      .filter(report => {
        const value = String(report.reportDate || '').slice(0, 10)
        return key.length === 10 ? value === key : value.startsWith(key)
      })
      .reduce((sum, report) => sum + Number(report.totalExpenditure || 0), 0)

    const dayIn = inFor(todayKey)
    const dayOut = outFor(todayKey)
    const monthIn = inFor(monthKey)
    const monthOut = outFor(monthKey)
    const yearIn = inFor(yearKey)
    const yearOut = outFor(yearKey)

    return {
      dayIn,
      dayOut,
      monthIn,
      monthOut,
      yearIn,
      yearOut,
      dayNet: dayIn - dayOut,
      monthNet: monthIn - monthOut,
      yearNet: yearIn - yearOut,
    }
  }, [reports, todayKey, monthKey, yearKey])

  function review(report) {
    setSelected(report)
  }

  function clearFilters() {
    setDate('')
    setYear('')
    setAmount('')
  }

  return <div className="reports-page">
    <section className="card full">
      <div className="card-head">
        <div>
          <span className="eyebrow">Central archive</span>
          <h2>Reports</h2>
          <p className="card-subtitle">The official saved Weekly Report is the source of truth for money in, money out, attendance, and report details.</p>
        </div>
        <button type="button" className="secondary" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="report-filters">
        <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Year<input type="number" min="2000" max="2100" placeholder="2026" value={year} onChange={e => setYear(e.target.value)} /></label>
        <label>Amount<input type="number" min="0" step="0.01" placeholder="Search amount" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      </div>
    </section>

    <section className="report-money-grid">
      <MoneyCard title="Today" inValue={financeTotals.dayIn} outValue={financeTotals.dayOut} net={financeTotals.dayNet} />
      <MoneyCard title="This month" inValue={financeTotals.monthIn} outValue={financeTotals.monthOut} net={financeTotals.monthNet} />
      <MoneyCard title="This year" inValue={financeTotals.yearIn} outValue={financeTotals.yearOut} net={financeTotals.yearNet} />
    </section>

    {error && <div className="toast toast-error" role="alert">{error}</div>}
    <section className="card full">
      <div className="card-head"><div><span className="eyebrow">Stored expense records</span><h2>Money out records</h2><p className="card-subtitle">These are legacy Expense records stored in the database. They are shown separately from Weekly Report totals so the same expense is not counted twice.</p></div></div>
      {expenses.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Money out</th></tr></thead><tbody>{expenses.slice(0, 50).map(item => <tr key={item.id}><td>{dateLabel(item.date || item.recordDate)}</td><td><b>{item.description || item.title || 'Expense'}</b></td><td>{item.category || 'General'}</td><td>{money(item.amount)}</td></tr>)}</tbody></table></div> : <p>No legacy Expense records are currently returned by the database.</p>}
    </section>
    <section className="card full">
      <div className="card-head"><div><span className="eyebrow">Saved weekly reports</span><h2>{filtered.length} report{filtered.length === 1 ? '' : 's'}</h2></div></div>
      {loading ? <p>Loading saved reports…</p> : filtered.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Money in</th><th>Money out</th><th>Balance</th><th>Attendance</th><th>Actions</th></tr></thead><tbody>{filtered.map(report => {
        const attendance = (report.numerical || []).reduce((sum, row) => sum + Number(row.total || 0), 0)
        return <tr key={report.id}>
          <td><b>{dateLabel(report.reportDate)}</b></td>
          <td>{money(report.totalIncome)}</td>
          <td>{money(report.totalExpenditure)}</td>
          <td className={Number(report.balance) >= 0 ? 'positive' : 'negative'}>{money(report.balance)}</td>
          <td>{attendance.toLocaleString('en-NG')}</td>
          <td><div className="report-row-actions"><button className="secondary small-button" onClick={() => review(report)}>Review</button><button className="secondary small-button" onClick={() => onEdit(String(report.reportDate).slice(0, 10))}>Edit</button></div></td>
        </tr>
      })}</tbody></table></div> : <p>No saved weekly reports match these filters.</p>}
    </section>

    {selected && <ReviewPanel report={selected} close={() => setSelected(null)} onEdit={() => { setSelected(null); onEdit(String(selected.reportDate).slice(0, 10)) }} />}
  </div>
}

function MoneyCard({ title, inValue, outValue, net }) {
  return <section className="card money-summary">
    <div><span className="eyebrow">{title}</span><h3>{money(net)}</h3></div>
    <div className="money-lines"><span><b>Money in</b><strong>{money(inValue)}</strong></span><span><b>Money out</b><strong>{money(outValue)}</strong></span></div>
  </section>
}

function ReviewPanel({ report, close, onEdit }) {
  return <div className="backdrop" onMouseDown={close}>
    <div className="modal report-review-modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">Read-only review</span><h2>{dateLabel(report.reportDate)}</h2></div><button className="close" onClick={close}>×</button></div>
      <div className="review-total-grid"><div><small>Money in</small><b>{money(report.totalIncome)}</b></div><div><small>Money out</small><b>{money(report.totalExpenditure)}</b></div><div><small>Balance</small><b>{money(report.balance)}</b></div></div>
      <div className="table-wrap"><table><thead><tr><th>Service</th><th>Adult</th><th>Children</th><th>Visitor</th><th>Total</th></tr></thead><tbody>{(report.numerical || []).map(row => <tr key={row.sn}><td>{row.service}</td><td>{row.adult}</td><td>{row.children}</td><td>{row.visitor}</td><td><b>{row.total}</b></td></tr>)}</tbody></table></div>
      <div className="review-finance"><h3>Income</h3>{(report.income || []).filter(row => Number(row.amount) > 0).map(row => <p key={row.sn}><span>{row.name || 'Other'}</span><b>{money(row.amount)}</b></p>)}<h3>Expenditure</h3>{(report.expenditure || []).filter(row => Number(row.amount) > 0).map(row => <p key={row.sn}><span>{row.name || 'Other'}</span><b>{money(row.amount)}</b></p>)}</div>
      <div className="record-actions"><button className="secondary" onClick={() => window.print()}>Print / PDF</button><button className="primary" onClick={onEdit}>Edit report</button></div>
    </div>
  </div>
}

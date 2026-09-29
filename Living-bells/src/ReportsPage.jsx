import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { money, dateLabel } from './weeklyReportConfig'

export default function ReportsPage({ user }) {
  const [reports,setReports]=useState([])
  const [selected,setSelected]=useState(null)
  const [search,setSearch]=useState('')
  const [month,setMonth]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [reviewing,setReviewing]=useState(false)

  async function load() {
    try {
      setLoading(true); setError('')
      const params={}
      if(search.trim()) params.search=search.trim()
      if(month) params.month=month
      const data=await api.weeklyReports(params)
      setReports(data||[])
      if(selected) {
        const fresh=(data||[]).find(r=>r.id===selected.id)
        if(fresh) setSelected(fresh)
      }
    } catch(e) { setError(e.message||'Could not load reports') }
    finally { setLoading(false) }
  }

  useEffect(()=>{ load() }, [month])

  const visible=useMemo(()=>{
    const q=search.trim().toLowerCase()
    if(!q) return reports
    return reports.filter(r=>`${r.reportDate} ${r.status} ${r.submittedBy?.name||''}`.toLowerCase().includes(q))
  },[reports,search])

  async function review() {
    if(!selected || user.role!=='ADMIN') return
    const rating=window.prompt('Enter review rating: Excellent, Good, Fair, Poor or Bad')
    if(!rating) return
    const normalized=rating.trim().toUpperCase()
    if(!['EXCELLENT','GOOD','FAIR','POOR','BAD'].includes(normalized)) {
      setError('Rating must be Excellent, Good, Fair, Poor or Bad')
      return
    }
    const comment=window.prompt('Optional review comment') || ''
    try {
      setReviewing(true); setError('')
      const updated=await api.reviewWeeklyReport(selected.id,{rating:normalized,comment})
      setSelected(updated)
      setReports(current=>current.map(r=>r.id===updated.id?updated:r))
    } catch(e) { setError(e.message||'Could not review report') }
    finally { setReviewing(false) }
  }

  function print() {
    document.title=`Living Bells - Weekly Report - ${dateLabel(selected?.reportDate)}`
    window.print()
    setTimeout(()=>{document.title='Living Bells'},500)
  }

  return <div className="weekly-page">
    <section className="card full">
      <div className="card-head">
        <div><span className="eyebrow">Archive</span><h2>Weekly reports</h2><p className="card-subtitle">Every submitted Sunday report is stored here as one complete record.</p></div>
        <div className="record-actions"><button className="secondary" onClick={load}>Refresh</button>{selected&&<button className="secondary" onClick={print}>Print report</button>}{selected&&user.role==='ADMIN'&&<button className="primary" disabled={reviewing} onClick={review}>{reviewing?'Reviewing…':'Review report'}</button>}</div>
      </div>
      {error&&<div className="toast toast-error" role="alert">{error}</div>}
      <div className="report-filters">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search Sunday or staff..." aria-label="Search weekly reports" />
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} aria-label="Filter reports by month" />
        <button className="secondary" onClick={()=>{setSearch('');setMonth('')}}>Clear</button>
      </div>
      {loading?<p>Loading saved reports...</p>:visible.length?<div className="table-wrap"><table><thead><tr><th>Sunday</th><th>Status</th><th>Submitted by</th><th>Total income</th><th>Total expenditure</th><th>Balance</th></tr></thead><tbody>{visible.map(r=><tr key={r.id} className={selected?.id===r.id?'selected-row':''}><td><button className="history-link" onClick={()=>setSelected(r)}>{dateLabel(r.reportDate)}</button></td><td><span className="pill">{r.status==='REVIEWED'?'Reviewed':'Submitted'}</span></td><td>{r.submittedBy?.name||r.createdBy?.name||'Unknown'}</td><td>{money(r.totalIncome)}</td><td>{money(r.totalExpenditure)}</td><td>{money(r.balance)}</td></tr>)}</tbody></table></div>:<p>No submitted weekly reports found.</p>}
    </section>
    {selected&&<ReportDetail report={selected}/>}
  </div>
}

function ReportDetail({report}) {
  const numerical=Array.isArray(report.numerical)?report.numerical:[]
  const income=Array.isArray(report.income)?report.income:[]
  const expenditure=Array.isArray(report.expenditure)?report.expenditure:[]
  const spiritual=report.spiritual||{}
  return <section className="card full report-detail">
    <div className="card-head"><div><span className="eyebrow">Sunday record</span><h2>{dateLabel(report.reportDate)}</h2><p className="card-subtitle">Submitted {report.submittedAt?new Date(report.submittedAt).toLocaleString('en-NG'):'previously stored'} • {report.submittedBy?.name||report.createdBy?.name||'Unknown'}</p></div><span className="save-state saved">{report.status==='REVIEWED'?'Reviewed':'Submitted • locked'}</span></div>
    <section className="weekly-section"><div className="weekly-section-title">A. NUMERICAL SECTION</div><div className="table-wrap"><table className="weekly-table"><thead><tr><th>S/N</th><th>Service</th><th>Adult</th><th>Children</th><th>Visitor</th><th>Total</th></tr></thead><tbody>{numerical.map(row=><tr key={row.sn}><td>{row.sn}</td><td>{row.service}</td><td>{row.adult}</td><td>{row.children}</td><td>{row.visitor}</td><td><b>{row.total}</b></td></tr>)}</tbody></table></div></section>
    <section className="weekly-section"><div className="weekly-section-title">B. SPIRITUAL EXPERIENCES</div><div className="spiritual-grid">{Object.entries(spiritual).map(([label,value])=><div key={label} className="report-value"><span>{label}</span><b>{value}</b></div>)}</div></section>
    <section className="weekly-section"><div className="weekly-section-title">C. FINANCE</div><div className="finance-columns"><FinanceReadOnly title="INCOME" rows={income} total={report.totalIncome}/><FinanceReadOnly title="EXPENDITURE" rows={expenditure} total={report.totalExpenditure}/></div><div className="balance-box"><div><span>Total Income</span><b>{money(report.totalIncome)}</b></div><div><span>Total Expenditure</span><b>{money(report.totalExpenditure)}</b></div><div className={Number(report.balance)>=0?'surplus':'deficit'}><span>Balance</span><b>{money(Math.abs(Number(report.balance)))}</b></div></div></section>
    {report.status==='REVIEWED'&&<section className="review-card"><div><b>Admin review</b><span className="review-rating">{report.reviewRating}</span></div>{report.reviewComment&&<p>{report.reviewComment}</p>}<small>{report.reviewedBy?.name||'Admin'} • {report.reviewedAt?new Date(report.reviewedAt).toLocaleString('en-NG'):''}</small></section>}
  </section>
}

function FinanceReadOnly({title,rows,total}) {
  return <div className="finance-table"><h3>{title}</h3><div className="table-wrap"><table className="weekly-table"><thead><tr><th>S/N</th><th>{title}</th><th>AMOUNT</th></tr></thead><tbody>{rows.map(row=><tr key={row.sn}><td>{row.sn}</td><td>{row.name||'—'}</td><td>{money(row.amount)}</td></tr>)}<tr className="total-row"><td colSpan="2">TOTAL</td><td>{money(total)}</td></tr></tbody></table></div></div>
}

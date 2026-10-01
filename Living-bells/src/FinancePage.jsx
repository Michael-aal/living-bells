import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import WeeklyPrintSheet from './WeeklyPrintSheet'
import { CURRENCY, money, normalizeReport, reportPayload, totals, dateLabel, emptyReport } from './weeklyReportConfig'

const canEdit = role => ['ADMIN','SECRETARY','PASTOR','STAFF'].includes(role)
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b)

export default function FinancePage({ user, initialDate = null }) {
  const baseReport = emptyReport(initialDate || undefined)
  const [reports,setReports]=useState([]),[report,setReport]=useState(baseReport),[saved,setSaved]=useState(baseReport)
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [selectedDate,setSelectedDate]=useState(baseReport.reportDate),[printReport,setPrintReport]=useState(baseReport)
  const editable=canEdit(user.role),dirty=useMemo(()=>!same(reportPayload(report),reportPayload(saved)),[report,saved]),summary=useMemo(()=>totals(report),[report])
  useEffect(()=>{loadHistory()},[])
  useEffect(()=>{const handler=e=>{if(dirty)e.preventDefault()};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirty])
  async function loadHistory(){try{setLoading(true);setError('');const data=await api.weeklyReports();setReports(data||[]);const current=(data||[]).find(r=>String(r.reportDate).slice(0,10)===selectedDate);if(current){const n=normalizeReport(current);setReport(n);setSaved(n)}}catch(e){setError(e.message||'Could not load weekly finance reports')}finally{setLoading(false)}}
  function selectDate(date){if(dirty&&!window.confirm('You have unsaved changes. Discard them and open another report?'))return;setSelectedDate(date);const existing=reports.find(r=>String(r.reportDate).slice(0,10)===date);const n=existing?normalizeReport(existing):emptyReport(date);setReport(n);setSaved(n);setPrintReport(n);setNotice(existing?'Saved report loaded.':'New report for this date.')}
  function update(section,index,key,value){setReport(current=>({...current,[section]:current[section].map((row,i)=>i===index?{...row,[key]:key==='amount'?Math.max(0,Math.round((Number(value)||0)*100)/100):value}:row)}))}
  async function save(){if(!editable)return;try{setSaving(true);setError('');const savedDate=report.reportDate;const payload=reportPayload(report);const savedReport=report.id?await api.updateWeeklyReport(report.id,payload):await api.saveWeeklyReport(payload);const savedSnapshot=normalizeReport(savedReport);setReports(current=>[savedReport,...current.filter(r=>String(r.reportDate).slice(0,10)!==savedDate)]);setPrintReport(savedSnapshot);const next=new Date(String(savedDate).slice(0,10)+'T12:00:00');next.setDate(next.getDate()+7);const nextDate=next.toISOString().slice(0,10);const blank=emptyReport(nextDate);setSelectedDate(nextDate);setReport(blank);setSaved(blank);setNotice('Weekly finance report saved. The saved report is ready in the archive and for PDF printing.');setTimeout(()=>setNotice(''),3000)}catch(e){setError(e.message||'Could not save the weekly finance report')}finally{setSaving(false)}}
  async function deleteReport(id) { if(!id||!window.confirm('Delete this weekly finance report? This cannot be undone.')) return; try { await api.deleteWeeklyReport(id); setReports(current=>current.filter(r=>r.id!==id)); if(report.id===id){const blank=emptyReport(selectedDate);setReport(blank);setSaved(blank);setPrintReport(blank)} setNotice('Weekly finance report deleted.'); } catch(e){setError(e.message||'Could not delete weekly finance report')} }
  async function createFinanceOption(kind) {
    const name = window.prompt(kind === 'INCOME' ? 'New money-in option name' : 'New money-out option name')
    if (!name?.trim()) return
    try {
      const created = await api.createOption({ kind: kind === 'INCOME' ? 'FINANCE_INCOME' : 'FINANCE_EXPENSE', name: name.trim() })
      const section = kind === 'INCOME' ? 'income' : 'expenditure'
      setReport(current => ({ ...current, [section]: [...current[section], { sn: current[section].length + 1, name: created.name, amount: 0 }] }))
      setSaved(current => ({ ...current, [section]: [...current[section], { sn: current[section].length + 1, name: created.name, amount: 0 }] }))
      setNotice(created.offline ? 'Finance option saved offline and will sync automatically.' : 'Finance option created.')
    } catch (error) { setError(error.message || 'Could not create finance option') }
  }
  function printPdf(){const target=report.id?report:printReport;setPrintReport(target);requestAnimationFrame(()=>window.print())}
  return <div className="weekly-page">
    {loading&&<div className="card full" role="status">Loading weekly report…</div>}
    <section className="card full weekly-editor">
      <div className="card-head"><div><span className="eyebrow">Weekly report • Finance</span><h2>Finance</h2><p className="card-subtitle">Section C of the church Weekly Report Form. {editable?'You can edit this report.':'Read-only access.'}</p></div><div className="record-actions">{dirty&&<span className="save-state unsaved">Unsaved changes</span>}{!dirty&&<span className="save-state saved">Saved</span>}{editable&&<button className="primary" disabled={saving||!dirty} onClick={save}>{saving?'Saving…':'Save report'}</button>}<details className="action-menu"><summary className="secondary">More</summary><div className="action-menu-panel"><button type="button" onClick={() => createFinanceOption('INCOME')}>Create income</button><button type="button" onClick={() => createFinanceOption('EXPENSE')}>Create expense</button><button type="button" onClick={printPdf}>Save PDF</button></div></details></div></div>
      {notice&&<div className="toast" role="status">{notice}</div>}{error&&<div className="toast toast-error" role="alert">{error}</div>}{error&&<div className="form-error weekly-error" role="alert">{error}</div>}
      <label className="report-date">Weekly report date<input aria-label="Weekly report date" type="date" value={report.reportDate} onChange={e=>selectDate(e.target.value)} /></label>
      <div className="finance-columns"><FinanceTable title="INCOME" section="income" rows={report.income} editable={editable} update={update} total={summary.totalCredit}/><FinanceTable title="EXPENDITURE" section="expenditure" rows={report.expenditure} editable={editable} update={update} total={summary.totalExpenditure}/></div>
      <div className="balance-box"><div><span>Total Credit</span><b>{money(summary.totalCredit)}</b></div><div><span>Total Expenditure</span><b>{money(summary.totalExpenditure)}</b></div><div className={summary.balance>=0?'surplus':'deficit'}><span>Total Balance: {summary.balance>=0?'Surplus':'Deficit'}</span><b>{money(Math.abs(summary.balance))}</b></div></div>
    </section>
    <History reports={reports} selectedDate={selectedDate} onSelect={selectDate} onDelete={deleteReport}/>
    <WeeklyPrintSheet report={report.id?report:printReport}/>
  </div>
}

function FinanceTable({title,section,rows,editable,update,total}){
  const customCount=section==='income'?3:2, fixedCount=rows.length-customCount
  return <section className="finance-table"><h3>{title}</h3><div className="table-wrap"><table className="weekly-table"><thead><tr><th>S/N</th><th>{title}</th><th>AMOUNT</th></tr></thead><tbody>
    {rows.map((row,index)=><tr key={row.sn}><td>{row.sn}</td><td><label className="sr-only" htmlFor={title+row.sn}>{title} item {row.sn}</label><input id={title+row.sn} className="text-cell" value={row.name} readOnly={!editable||index<fixedCount} placeholder={index>=fixedCount?'Custom item':''} onChange={e=>update(section,index,'name',e.target.value)}/></td><td><label className="money-input"><span>{CURRENCY}</span><input aria-label={row.name||title+' custom item'} inputMode="decimal" type="number" min="0" step="0.01" value={row.amount} disabled={!editable} onChange={e=>update(section,index,'amount',e.target.value)}/></label></td></tr>)}
    <tr className="total-row"><td colSpan="2">TOTAL</td><td>{money(total)}</td></tr>
  </tbody></table></div></section>
}
function History({reports,selectedDate,onSelect,onDelete}){return <section className="card full"><div className="card-head"><div><span className="eyebrow">Archive</span><h2>Past weekly finance reports</h2></div></div>{reports.length?<div className="table-wrap"><table><thead><tr><th>Date</th><th>Total Credit</th><th>Total Expenditure</th><th>Balance</th><th>Action</th></tr></thead><tbody>{reports.map(r=>{const balance=Number(r.balance),date=String(r.reportDate).slice(0,10);return <tr key={r.id} className={date===selectedDate?'selected-row':''}><td><button className="history-link" onClick={()=>onSelect(date)}>{dateLabel(date)}</button></td><td>{money(r.totalIncome)}</td><td>{money(r.totalExpenditure)}</td><td className={balance>=0?'positive':'negative'}>{balance>=0?'Surplus':'Deficit'} {money(Math.abs(balance))}</td><td><button type="button" className="danger-button" onClick={()=>onDelete(r.id)}>Delete</button></td></tr>})}</tbody></table></div>:<p>No saved weekly finance reports yet.</p>}</section>}

import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import WeeklyPrintSheet from './WeeklyPrintSheet'
import { CURRENCY, money, normalizeReport, reportPayload, totals, dateLabel, emptyReport } from './weeklyReportConfig'

const canEdit = role => ['ADMIN','SECRETARY'].includes(role)
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b)

export default function FinancePage({ user }) {
  const [reports,setReports]=useState([]),[report,setReport]=useState(emptyReport()),[saved,setSaved]=useState(emptyReport())
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [selectedDate,setSelectedDate]=useState(emptyReport().reportDate)
  const editable=canEdit(user.role),dirty=useMemo(()=>!same(reportPayload(report),reportPayload(saved)),[report,saved]),summary=useMemo(()=>totals(report),[report])
  useEffect(()=>{loadHistory()},[])
  useEffect(()=>{const handler=e=>{if(dirty)e.preventDefault()};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirty])
  async function loadHistory(){try{setLoading(true);setError('');const data=await api.weeklyReports();setReports(data||[]);const current=(data||[]).find(r=>String(r.reportDate).slice(0,10)===selectedDate);if(current){const n=normalizeReport(current);setReport(n);setSaved(n)}}catch(e){setError(e.message||'Could not load weekly finance reports')}finally{setLoading(false)}}
  function selectDate(date){if(dirty&&!window.confirm('You have unsaved changes. Discard them and open another report?'))return;setSelectedDate(date);const existing=reports.find(r=>String(r.reportDate).slice(0,10)===date);const n=existing?normalizeReport(existing):emptyReport(date);setReport(n);setSaved(n);setNotice(existing?'Saved report loaded.':'New report for this date.')}
  function update(section,index,key,value){setReport(current=>({...current,[section]:current[section].map((row,i)=>i===index?{...row,[key]:key==='amount'?Math.max(0,Math.round((Number(value)||0)*100)/100):value}:row)}))}
  async function save(){if(!editable)return;try{setSaving(true);setError('');const savedReport=await api.saveWeeklyReport(reportPayload(report));const n=normalizeReport(savedReport);setReport(n);setSaved(n);setReports(current=>[savedReport,...current.filter(r=>String(r.reportDate).slice(0,10)!==report.reportDate)]);setNotice('Weekly finance report saved successfully.');setTimeout(()=>setNotice(''),3000)}catch(e){setError(e.message||'Could not save the weekly finance report')}finally{setSaving(false)}}
  return <div className="weekly-page">
    <section className="card full weekly-editor">
      <div className="card-head"><div><span className="eyebrow">Weekly report • Finance</span><h2>Finance</h2><p className="card-subtitle">Section C of the church Weekly Report Form. {editable?'You can edit this report.':'Read-only access.'}</p></div><div className="record-actions">{dirty&&<span className="save-state unsaved">Unsaved changes</span>}{!dirty&&<span className="save-state saved">Saved</span>}{editable&&<button className="primary" disabled={saving||!dirty} onClick={save}>{saving?'Saving…':'Save report'}</button>}<button className="secondary" onClick={()=>window.print()}>Print / PDF</button></div></div>
      {notice&&<div className="toast" role="status">{notice}</div>}{error&&<div className="form-error weekly-error" role="alert">{error}</div>}
      <label className="report-date">Weekly report date<input aria-label="Weekly report date" type="date" value={report.reportDate} onChange={e=>selectDate(e.target.value)} /></label>
      <div className="finance-columns"><FinanceTable title="INCOME" section="income" rows={report.income} editable={editable} update={update} total={summary.totalCredit}/><FinanceTable title="EXPENDITURE" section="expenditure" rows={report.expenditure} editable={editable} update={update} total={summary.totalExpenditure}/></div>
      <div className="balance-box"><div><span>Total Credit</span><b>{money(summary.totalCredit)}</b></div><div><span>Total Expenditure</span><b>{money(summary.totalExpenditure)}</b></div><div className={summary.balance>=0?'surplus':'deficit'}><span>Total Balance: {summary.balance>=0?'Surplus':'Deficit'}</span><b>{money(Math.abs(summary.balance))}</b></div></div>
    </section>
    <History reports={reports} selectedDate={selectedDate} onSelect={selectDate}/>
    <WeeklyPrintSheet report={report}/>
  </div>
}

function FinanceTable({title,section,rows,editable,update,total}){
  const customCount=section==='income'?3:2, fixedCount=rows.length-customCount
  return <section className="finance-table"><h3>{title}</h3><div className="table-wrap"><table className="weekly-table"><thead><tr><th>S/N</th><th>{title}</th><th>AMOUNT</th></tr></thead><tbody>
    {rows.map((row,index)=><tr key={row.sn}><td>{row.sn}</td><td><label className="sr-only" htmlFor={title+row.sn}>{title} item {row.sn}</label><input id={title+row.sn} className="text-cell" value={row.name} readOnly={!editable||index<fixedCount} placeholder={index>=fixedCount?'Custom item':''} onChange={e=>update(section,index,'name',e.target.value)}/></td><td><label className="money-input"><span>{CURRENCY}</span><input aria-label={row.name||title+' custom item'} inputMode="decimal" type="number" min="0" step="0.01" value={row.amount} disabled={!editable} onChange={e=>update(section,index,'amount',e.target.value)}/></label></td></tr>)}
    <tr className="total-row"><td colSpan="2">TOTAL</td><td>{money(total)}</td></tr>
  </tbody></table></div></section>
}
function History({reports,selectedDate,onSelect}){return <section className="card full"><div className="card-head"><div><span className="eyebrow">Archive</span><h2>Past weekly finance reports</h2></div></div>{reports.length?<div className="table-wrap"><table><thead><tr><th>Date</th><th>Total Credit</th><th>Total Expenditure</th><th>Balance</th></tr></thead><tbody>{reports.map(r=>{const balance=Number(r.balance),date=String(r.reportDate).slice(0,10);return <tr key={r.id} className={date===selectedDate?'selected-row':''}><td><button className="history-link" onClick={()=>onSelect(date)}>{dateLabel(date)}</button></td><td>{money(r.totalIncome)}</td><td>{money(r.totalExpenditure)}</td><td className={balance>=0?'positive':'negative'}>{balance>=0?'Surplus':'Deficit'} {money(Math.abs(balance))}</td></tr>})}</tbody></table></div>:<p>No saved weekly finance reports yet.</p>}</section>}

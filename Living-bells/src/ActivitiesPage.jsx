import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import WeeklyPrintSheet from './WeeklyPrintSheet'
import { NUMERICAL_ROWS, SPIRITUAL_ROWS, emptyReport, normalizeReport, reportPayload, money, dateLabel } from './weeklyReportConfig'

const canEdit = role => ['ADMIN','SECRETARY'].includes(role)
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b)

export default function ActivitiesPage({ user }) {
  const base=emptyReport(),[reports,setReports]=useState([]),[report,setReport]=useState(base),[saved,setSaved]=useState(base)
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selectedDate,setSelectedDate]=useState(base.reportDate)
  const editable=canEdit(user.role),dirty=useMemo(()=>!same(reportPayload(report),reportPayload(saved)),[report,saved])
  useEffect(()=>{loadHistory()},[])
  useEffect(()=>{const handler=e=>{if(dirty)e.preventDefault()};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirty])
  async function loadHistory(){try{setLoading(true);setError('');const data=await api.weeklyReports();setReports(data||[]);const current=(data||[]).find(r=>String(r.reportDate).slice(0,10)===selectedDate);if(current){const n=normalizeReport(current);setReport(n);setSaved(n)}}catch(e){setError(e.message||'Could not load weekly activity reports')}finally{setLoading(false)}}
  function selectDate(date){if(dirty&&!window.confirm('You have unsaved changes. Discard them and open another report?'))return;setSelectedDate(date);const existing=reports.find(r=>String(r.reportDate).slice(0,10)===date);const n=existing?normalizeReport(existing):emptyReport(date);setReport(n);setSaved(n);setNotice(existing?'Saved report loaded.':'New report for this date.')}
  function setNumerical(index,key,value){const number=Math.max(0,Math.trunc(Number(value)||0));setReport(current=>({...current,numerical:current.numerical.map((row,i)=>i===index?{...row,[key]:number,total:key==='adult'?number+row.children+row.visitor:key==='children'?row.adult+number+row.visitor:row.adult+row.children+number}:row)}))}
  function setSpiritual(label,value){setReport(current=>({...current,spiritual:{...current.spiritual,[label]:Math.max(0,Math.trunc(Number(value)||0))}}))}
  const columnTotals=useMemo(()=>report.numerical.reduce((a,row)=>({adult:a.adult+row.adult,children:a.children+row.children,visitor:a.visitor+row.visitor,total:a.total+row.total}),{adult:0,children:0,visitor:0,total:0}),[report.numerical])
  async function save(){if(!editable)return;try{setSaving(true);setError('');const savedReport=await api.saveWeeklyReport(reportPayload(report));const n=normalizeReport(savedReport);setReport(n);setSaved(n);setReports(current=>[savedReport,...current.filter(r=>String(r.reportDate).slice(0,10)!==report.reportDate)]);setNotice('Weekly activities report saved successfully.');setTimeout(()=>setNotice(''),3000)}catch(e){setError(e.message||'Could not save the weekly activities report')}finally{setSaving(false)}}
  return <div className="weekly-page">
    {loading&&<div className="card full" role="status">Loading weekly report…</div>}
    <section className="card full weekly-editor">
      <div className="card-head"><div><span className="eyebrow">Weekly report • Activities</span><h2>Activities</h2><p className="card-subtitle">Sections A and B of the church Weekly Report Form. {editable?'You can edit this report.':'Read-only access.'}</p></div><div className="record-actions">{dirty&&<span className="save-state unsaved">Unsaved changes</span>}{!dirty&&<span className="save-state saved">Saved</span>}{editable&&<button className="primary" disabled={saving||!dirty} onClick={save}>{saving?'Saving…':'Save report'}</button>}<button className="secondary" onClick={()=>window.print()}>Print / PDF</button></div></div>
      {notice&&<div className="toast" role="status">{notice}</div>}{error&&<div className="toast toast-error" role="alert">{error}</div>}{error&&<div className="form-error weekly-error" role="alert">{error}</div>}
      <label className="report-date">Weekly report date<input aria-label="Weekly report date" type="date" value={report.reportDate} onChange={e=>selectDate(e.target.value)}/></label>
      <section className="weekly-section"><div className="weekly-section-title">A. NUMERICAL SECTION (ACTUAL)</div><div className="table-wrap"><table className="weekly-table activities-table"><thead><tr><th>S/N</th><th>Service Type</th><th>Adult</th><th>Children</th><th>Visitor</th><th>Total</th></tr></thead><tbody>
        {report.numerical.map((row,index)=><tr key={row.sn}><td>{index+1}</td><td><b>{NUMERICAL_ROWS[index]}</b></td>{['adult','children','visitor'].map(key=><td key={key}><label className="sr-only" htmlFor={'activity-'+index+'-'+key}>{NUMERICAL_ROWS[index]+' '+key}</label><input id={'activity-'+index+'-'+key} type="number" min="0" step="1" inputMode="numeric" value={row[key]} disabled={!editable} onChange={e=>setNumerical(index,key,e.target.value)}/></td>)}<td><b>{row.total}</b></td></tr>)}
        <tr className="total-row"><td colSpan="2">TOTAL</td><td>{columnTotals.adult}</td><td>{columnTotals.children}</td><td>{columnTotals.visitor}</td><td>{columnTotals.total}</td></tr>
      </tbody></table></div></section>
      <section className="weekly-section"><div className="weekly-section-title">B. SPIRITUAL EXPERIENCES (ACTUAL)</div><div className="spiritual-grid">{SPIRITUAL_ROWS.map(label=><label key={label}>{label}<input type="number" min="0" step="1" inputMode="numeric" value={report.spiritual[label]} disabled={!editable} onChange={e=>setSpiritual(label,e.target.value)}/></label>)}</div></section>
    </section>
    <History reports={reports} selectedDate={selectedDate} onSelect={selectDate}/><WeeklyPrintSheet report={report}/>
  </div>
}
function History({reports,selectedDate,onSelect}){return <section className="card full"><div className="card-head"><div><span className="eyebrow">Archive</span><h2>Past weekly activity reports</h2></div></div>{reports.length?<div className="table-wrap"><table><thead><tr><th>Date</th><th>Credit</th><th>Expenditure</th><th>Balance</th></tr></thead><tbody>{reports.map(r=>{const date=String(r.reportDate).slice(0,10);return <tr key={r.id} className={date===selectedDate?'selected-row':''}><td><button className="history-link" onClick={()=>onSelect(date)}>{dateLabel(date)}</button></td><td>{money(r.totalIncome)}</td><td>{money(r.totalExpenditure)}</td><td className={Number(r.balance)>=0?'positive':'negative'}>{Number(r.balance)>=0?'Surplus':'Deficit'} {money(Math.abs(Number(r.balance)))}</td></tr>})}</tbody></table></div>:<p>No saved weekly activity reports yet.</p>}</section>}

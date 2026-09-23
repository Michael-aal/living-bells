import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

const SERVICES=['Pre-Sunday prayer','Sunday School','Worship Service','Bible Study','House Fellowship','Prayer Meeting','Vigil','Revival Service','Intercessory Prayer','Anointing Service']
const SPIRITUAL=['No of Decision','No of Water Baptism','No of Healing','No of Conversion','No of Holy Spirit Baptism','No of Deliverance']
const INCOME=['Tithes','Missionary Offering','Sunday Sch. Offering','Building Offering','Welfare Offering','Worship Offering','Bible Study Offering','3rd Sunday offering','Thanksgiving Offering','Church Arms Offering','Camp/Convention','Loan/Cash Deposit','Love/Seed Faith Offering','Revival Offering','Special Offering','Fasting and Prayer','Inauguration','Prayer Meeting','Donation','Pledge','Anointing service','','','']
const EXPENDITURE=["Ministers' Allowance",'Transportation','Sun. Sch. Training/Rally','Holy Communion','Donation Gift','Land/Building Project','Revival/Crusade','Furniture','Stationeries/Printing','Retreat/Camp Conference','Medical','Purchase of New Equipment','Welfare','Entertainment','Diesel Fueling (Generator)','Repair-building','Repair-electrical','Utility Bill','Loan Repayment','Honourarium','Audio','Retreat/camping','','']

const initial=()=>({reportDate:new Date().toISOString().slice(0,10),numerical:SERVICES.map((service,i)=>({sn:i+1,service,adult:0,children:0,visitor:0,total:0})),spiritual:Object.fromEntries(SPIRITUAL.map(x=>[x,0])),income:INCOME.map((name,i)=>({sn:i+1,name,amount:0})),expenditure:EXPENDITURE.map((name,i)=>({sn:i+1,name,amount:0}))})
const money=n=>`₦${Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`

export default function WeeklyReports({user,demo=false}){
 const [reports,setReports]=useState([]),[form,setForm]=useState(initial),[editing,setEditing]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState(''),[month,setMonth]=useState(''),[year,setYear]=useState('')
 const totals=useMemo(()=>({income:form.income.reduce((a,r)=>a+Number(r.amount||0),0),expenditure:form.expenditure.reduce((a,r)=>a+Number(r.amount||0),0)}),[form.income,form.expenditure]),balance=totals.income-totals.expenditure
 async function load(){if(demo)return;try{setLoading(true);setError('');setReports(await api.weeklyReports({search,month,year}))}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[])
 const setNum=(i,k,v)=>setForm(f=>({...f,numerical:f.numerical.map((r,x)=>x!==i?r:{...r,[k]:Math.max(0,Number(v)||0),total:(k==='adult'?Number(v)||0:r.adult)+(k==='children'?Number(v)||0:r.children)+(k==='visitor'?Number(v)||0:r.visitor)})}))
 const setMoney=(section,i,v)=>setForm(f=>({...f,[section]:f[section].map((r,x)=>x===i?{...r,amount:Math.max(0,Number(v)||0)}:r)}))
 const setName=(section,i,v)=>setForm(f=>({...f,[section]:f[section].map((r,x)=>x===i?{...r,name:v}:r)}))
 const setSpiritual=(k,v)=>setForm(f=>({...f,spiritual:{...f.spiritual,[k]:Math.max(0,Number(v)||0)}}))
 async function save(){
  try{setLoading(true);setError('')
   const payload={...form,numerical:form.numerical.map(r=>({...r,total:r.adult+r.children+r.visitor}))}
   if(demo){setReports(r=>[{...payload,id:Date.now(),totalIncome:totals.income,totalExpenditure:totals.expenditure,balance},...r]);setForm(initial());return}
   const saved=editing?await api.updateWeeklyReport(editing,payload):await api.createWeeklyReport(payload)
   setReports(r=>[saved,...r.filter(x=>x.id!==saved.id)]);setEditing(null);setForm(initial())
  }catch(e){setError(e.message)}finally{setLoading(false)}
 }
 async function remove(id){if(!window.confirm('Delete this weekly report?'))return;try{await api.deleteWeeklyReport(id);setReports(r=>r.filter(x=>x.id!==id))}catch(e){setError(e.message)}}
 function edit(r){setEditing(r.id);setForm({...initial(),...r,reportDate:String(r.reportDate).slice(0,10)});window.scrollTo({top:0,behavior:'smooth'})}
 return <div className="weekly-page">
  {user.role!=='PASTOR'&&<section className="card full weekly-editor">
   <div className="card-head"><div><span className="eyebrow">Church reporting</span><h2>{editing?'Edit weekly report':'Weekly report form'}</h2><p className="card-subtitle">Official weekly report layout. All totals calculate automatically.</p></div><div className="record-actions">{editing&&<button className="secondary" onClick={()=>{setEditing(null);setForm(initial())}}>Cancel</button>}<button className="primary" disabled={loading} onClick={save}>{loading?'Saving…':editing?'Update report':'Save report'}</button></div></div>
   {error&&<div className="form-error weekly-error">{error}</div>}
   <label className="report-date">Report date<input type="date" value={form.reportDate} onChange={e=>setForm(f=>({...f,reportDate:e.target.value}))}/></label>
   <ReportSection title="A. NUMERICAL SECTION (ACTUAL)"><div className="table-wrap"><table className="weekly-table"><thead><tr><th>S/N</th><th>Service Type</th><th>Adult</th><th>Children</th><th>Visitor</th><th>Total</th></tr></thead><tbody>{form.numerical.map((r,i)=><tr key={r.sn}><td>{r.sn}</td><td><b>{r.service}</b></td>{['adult','children','visitor'].map(k=><td key={k}><input type="number" min="0" value={r[k]} onChange={e=>setNum(i,k,e.target.value)}/></td>)}<td><b>{r.total}</b></td></tr>)}</tbody></table></div></ReportSection>
   <ReportSection title="B. SPIRITUAL EXPERIENCES (ACTUAL)"><div className="spiritual-grid">{SPIRITUAL.map(k=><label key={k}>{k}<input type="number" min="0" value={form.spiritual[k]} onChange={e=>setSpiritual(k,e.target.value)}/></label>)}</div></ReportSection>
   <div className="finance-columns"><FinanceTable title="INCOME" section="income" rows={form.income} total={totals.income} setMoney={setMoney} setName={setName}/><FinanceTable title="EXPENDITURE" section="expenditure" rows={form.expenditure} total={totals.expenditure} setMoney={setMoney} setName={setName}/></div>
   <div className="balance-box"><div><span>Total Credit</span><b>{money(totals.income)}</b></div><div><span>Total Expenditure</span><b>{money(totals.expenditure)}</b></div><div className={balance>=0?'surplus':'deficit'}><span>Total Balance: {balance>=0?'Surplus':'Deficit'}</span><b>{money(Math.abs(balance))}</b></div></div>
  </section>}
  <section className="card full"><div className="card-head"><div><span className="eyebrow">Archive</span><h2>Weekly reports</h2></div><div className="report-filters"><input placeholder="Date (YYYY-MM-DD)" value={search} onChange={e=>setSearch(e.target.value)}/><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/><input placeholder="Year" inputMode="numeric" value={year} onChange={e=>setYear(e.target.value)}/><button className="secondary" onClick={load}>Filter</button></div></div>
   <div className="table-wrap"><table><thead><tr><th>Date</th><th>Credit</th><th>Expenditure</th><th>Balance</th><th>Created by</th><th>Actions</th></tr></thead><tbody>{reports.map(r=><tr key={r.id}><td><b>{new Date(r.reportDate).toLocaleDateString('en-NG')}</b></td><td>{money(r.totalIncome)}</td><td>{money(r.totalExpenditure)}</td><td className={Number(r.balance)>=0?'positive':'negative'}>{Number(r.balance)>=0?'Surplus ':'Deficit '}{money(Math.abs(Number(r.balance)))}</td><td>{r.createdBy?.name||'—'}</td><td className="record-actions">{user.role!=='PASTOR'&&<button className="secondary small-button" onClick={()=>edit(r)}>Edit</button>}<button className="secondary small-button" onClick={()=>window.print()}>Print</button>{(user.role==='ADMIN'||user.role==='SECRETARY')&&<button className="secondary small-button" onClick={()=>remove(r.id)}>Delete</button>}</td></tr>)}</tbody></table>{!reports.length&&<p>{loading?'Loading reports…':'No weekly reports found.'}</p>}</div>
  </section>
 </div>
}
function ReportSection({title,children}){return <section className="weekly-section"><div className="weekly-section-title">{title}</div>{children}</section>}
function FinanceTable({title,section,rows,total,setMoney,setName}){return <section className="finance-table"><h3>{title}</h3><div className="table-wrap"><table className="weekly-table"><thead><tr><th>S/N</th><th>{title}</th><th>AMOUNT</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.sn}><td>{r.sn}</td><td><input className="text-cell" value={r.name} placeholder="Custom item" readOnly={Boolean(r.name)} onChange={e=>setName(section,i,e.target.value)}/></td><td><input type="number" min="0" value={r.amount} onChange={e=>setMoney(section,i,e.target.value)}/></td></tr>)}<tr className="total-row"><td colSpan="2">TOTAL</td><td>{money(total)}</td></tr></tbody></table></div></section>}

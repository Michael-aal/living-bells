import { useMemo, useState } from 'react'
import './App.css'

const API = import.meta.env.VITE_API_BASE_URL || ''

const seedAttendance = [
  { id: 1, service: 'Sunday Service', date: '20 Sep 2026', total: 366 },
  { id: 2, service: 'Youth Meeting', date: '19 Sep 2026', total: 128 },
  { id: 3, service: 'Midweek Service', date: '16 Sep 2026', total: 214 },
]
const seedExpenses = [
  { id: 1, title: 'Generator fuel', category: 'Utilities', amount: 35000, date: '20 Sep 2026' },
  { id: 2, title: 'Choir uniforms', category: 'Choir', amount: 82000, date: '18 Sep 2026' },
  { id: 3, title: 'Outreach transport', category: 'Evangelism', amount: 28000, date: '14 Sep 2026' },
]

function App() {
  const [page, setPage] = useState('dashboard')
  const [attendance, setAttendance] = useState(seedAttendance)
  const [expenses, setExpenses] = useState(seedExpenses)
  const [modal, setModal] = useState(null)
  const [sync, setSync] = useState(API ? 'Live API' : 'Demo mode')
  const money = n => '₦' + Number(n).toLocaleString('en-NG')
  const totalSpend = useMemo(() => expenses.reduce((a, e) => a + e.amount, 0), [expenses])

  async function post(path, payload) {
    if (!API) return
    try {
      const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) throw new Error()
      setSync('Backend connected')
    } catch { setSync('Backend unavailable') }
  }

  function addAttendance(payload) {
    const total = Object.values(payload.groups).reduce((a, g) => a + Number(g.male || 0) + Number(g.female || 0), 0)
    setAttendance([{ id: Date.now(), service: payload.service, date: payload.date, total }, ...attendance])
    setModal(null); post('/api/attendance', payload)
  }
  function addExpense(payload) {
    const record = { ...payload, id: Date.now(), amount: Number(payload.amount) }
    setExpenses([record, ...expenses]); setModal(null); post('/api/expenses', record)
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo">L</div><div><b>Living Bells</b><small>Church operations</small></div></div>
      <span className="label">Workspace</span>
      {[
        ['dashboard','⌂','Dashboard'],['attendance','◉','Attendance'],['expenses','₦','Expenses'],
        ['activities','▣','Activities'],['reports','⌁','Reports'],['forms','□','Forms']
      ].map(([id,icon,name]) => <button key={id} className={page===id?'nav active':'nav'} onClick={()=>setPage(id)}><i>{icon}</i>{name}</button>)}
      <div className="side-status"><span/> <div><b>{sync}</b><small>{API?'API configured':'Set VITE_API_BASE_URL to sync'}</small></div></div>
    </aside>

    <main>
      <header><div className="mobile-brand"><div className="logo">L</div>Living Bells</div><div className="search">⌕ <span>Search records...</span></div><div className="avatar">ST</div></header>
      <section className="content">
        <div className="heading">
          <div><span className="eyebrow">Church operations</span><h1>{page==='dashboard'?'Good evening 👋':title(page)}</h1><p>{subtitle(page)}</p></div>
          <div className="actions"><button className="secondary" onClick={()=>setPage('reports')}>View reports</button><button className="primary" onClick={()=>setModal('attendance')}>+ Record</button></div>
        </div>

        {page==='dashboard' && <Dashboard attendance={attendance} expenses={expenses} spend={totalSpend} money={money} open={setModal} go={setPage}/>}
        {page==='attendance' && <Records title="Service attendance" eyebrow="Attendance records" action="Record attendance" onAdd={()=>setModal('attendance')}><table><thead><tr><th>Service</th><th>Date</th><th>Total people</th><th>Status</th></tr></thead><tbody>{attendance.map(r=><tr key={r.id}><td><b>{r.service}</b></td><td>{r.date}</td><td><b>{r.total}</b></td><td><span className="pill">Recorded</span></td></tr>)}</tbody></table></Records>}
        {page==='expenses' && <Records title="Expenses" eyebrow="Financial records" action="Record expense" onAdd={()=>setModal('expense')}><table><thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Amount</th></tr></thead><tbody>{expenses.map(r=><tr key={r.id}><td><b>{r.title}</b></td><td>{r.category}</td><td>{r.date}</td><td><b>{money(r.amount)}</b></td></tr>)}</tbody></table></Records>}
        {page==='activities' && <Empty title="Activities" text="Organize services, meetings and special church programs."/>}
        {page==='reports' && <div className="report-grid"><Card title="Attendance"><strong className="big">{attendance.reduce((a,r)=>a+r.total,0).toLocaleString()}</strong><p>Combined recorded attendance.</p></Card><Card title="Expenses"><strong className="big">{money(totalSpend)}</strong><p>Combined expenses in this workspace.</p></Card></div>}
        {page==='forms' && <div className="form-grid"><Action icon="◉" title="Attendance form" text="Children, teenagers, youth, adults, men and women." onClick={()=>setModal('attendance')}/><Action icon="₦" title="Expense form" text="Amount, category, description and date." onClick={()=>setModal('expense')}/></div>}
      </section>
    </main>

    {modal==='attendance' && <AttendanceForm close={()=>setModal(null)} save={addAttendance}/>}
    {modal==='expense' && <ExpenseForm close={()=>setModal(null)} save={addExpense}/>}
  </div>
}

function Dashboard({attendance,expenses,spend,money,open,go}) {
  return <>
    <div className="stats"><Stat icon="◉" name="Attendance" value={attendance[0]?.total||0} note="Latest service"/><Stat icon="₦" name="Expenses" value={money(spend)} note="Recorded this period"/><Stat icon="▣" name="Activities" value={attendance.length} note="Records"/><Stat icon="⌁" name="Reports" value="4" note="Ready to review"/></div>
    <div className="quick"><Action icon="◉" title="Record attendance" text="Capture children, teens, youth, adults, men and women." onClick={()=>open('attendance')}/><Action icon="₦" title="Record expense" text="Track church spending clearly." onClick={()=>open('expense')}/><Action icon="□" title="Open forms" text="Structured recurring records." onClick={()=>go('forms')}/></div>
    <div className="dash-grid"><Card title="Attendance trend"><div className="bars">{attendance.slice(0,7).reverse().map(r=><div className="bar-col" key={r.id}><b>{r.total}</b><div className="bar" style={{height:Math.max(25,Math.min(100,r.total/4))+'%'}}/><small>{r.date.slice(0,6)}</small></div>)}</div></Card><Card title="Recent spending"><div className="list">{expenses.map(e=><div className="row" key={e.id}><span className="mini">{e.title[0]}</span><div><b>{e.title}</b><small>{e.category}</small></div><strong>{money(e.amount)}</strong></div>)}</div></Card></div>
  </>
}
function Stat({icon,name,value,note}){return <div className="stat"><span className="stat-icon">{icon}</span><div><small>{name}</small><strong>{value}</strong><em>{note}</em></div></div>}
function Action({icon,title,text,onClick}){return <button className="action-card" onClick={onClick}><span className="stat-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><strong>→</strong></button>}
function Card({title,children}){return <section className="card"><div className="card-head"><h2>{title}</h2></div>{children}</section>}
function Records({title,eyebrow,action,onAdd,children}){return <section className="card full"><div className="card-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="primary" onClick={onAdd}>{action}</button></div><div className="table-wrap">{children}</div></section>}
function Empty({title,text}){return <section className="card empty"><div className="empty-icon">▣</div><span className="eyebrow">Coming next</span><h2>{title}</h2><p>{text}</p></section>}
function title(p){return ({attendance:'Attendance',expenses:'Expenses',activities:'Activities',reports:'Reports',forms:'Forms'})[p]||'Dashboard'}
function subtitle(p){return ({dashboard:'A clear view of what is happening across your church.',attendance:'Record and review service attendance.',expenses:'Track church spending in one place.',activities:'Keep church programs organized.',reports:'Turn records into useful summaries.',forms:'Structured forms for recurring church records.'})[p]}

function Modal({title,children,close}){return <div className="backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Living Bells</span><h2>{title}</h2></div><button className="close" onClick={close}>×</button></div>{children}</div></div>}
function AttendanceForm({close,save}){
  const [service,setService]=useState('Sunday Service'),[date,setDate]=useState('2026-09-20'),[groups,setGroups]=useState(Object.fromEntries(['Children','Teenagers','Youth','Adults'].map(x=>[x,{male:'',female:''}])))
  const update=(g,s,v)=>setGroups(x=>({...x,[g]:{...x[g],[s]:v}})),total=Object.values(groups).reduce((a,g)=>a+Number(g.male||0)+Number(g.female||0),0)
  return <Modal title="Record attendance" close={close}><label>Service<input value={service} onChange={e=>setService(e.target.value)}/></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="attendance-form"><div className="frow header"><span>Group</span><span>Male</span><span>Female</span></div>{Object.entries(groups).map(([g,v])=><div className="frow" key={g}><b>{g}</b><input type="number" min="0" value={v.male} onChange={e=>update(g,'male',e.target.value)} placeholder="0"/><input type="number" min="0" value={v.female} onChange={e=>update(g,'female',e.target.value)} placeholder="0"/></div>)}</div><div className="total">Total attendance <b>{total}</b></div><button className="primary wide" onClick={()=>save({service,date,groups})}>Save attendance</button></Modal>
}
function ExpenseForm({close,save}){
  const [d,setD]=useState({title:'',category:'General',amount:'',date:'2026-09-20'}),set=(k,v)=>setD(x=>({...x,[k]:v}))
  return <Modal title="Record expense" close={close}><label>Description<input value={d.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Generator fuel"/></label><label>Category<select value={d.category} onChange={e=>set('category',e.target.value)}>{['General','Utilities','Welfare','Choir','Evangelism','Media'].map(x=><option key={x}>{x}</option>)}</select></label><label>Amount<input type="number" min="0" value={d.amount} onChange={e=>set('amount',e.target.value)} placeholder="0"/></label><label>Date<input type="date" value={d.date} onChange={e=>set('date',e.target.value)}/></label><button className="primary wide" disabled={!d.title||!d.amount} onClick={()=>save(d)}>Save expense</button></Modal>
}
export default App

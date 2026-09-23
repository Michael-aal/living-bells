export const CURRENCY = '₦'

export const NUMERICAL_ROWS = [
  'Pre-Sunday Prayer','Sunday School','Worship Service','Bible Study','House Fellowship',
  'Prayer Meeting','Vigil','Revival Service','Intercessory Prayer','Anointing Service',
]
export const SPIRITUAL_ROWS = [
  'No. of Decision','No. of Water Baptism','No. of Healing','No. of Conversion',
  'No. of Holy Spirit Baptism','No. of Deliverance',
]
export const INCOME_ROWS = [
  'Tithes','Missionary Offering','Sunday Sch. Offering','Building Offering','Welfare Offering',
  'Worship Offering','Bible Study Offering','3rd Sunday Offering','Thanksgiving Offering',
  'Church Arms Offering','Camp / Convention','Loan / Cash Deposit','Love/Seed Faith Offering',
  'Revival Offering','Special Offering','Fasting and Prayer','Inauguration','Prayer Meeting',
  'Donation','Pledge','Anointing Service','','','',
]
export const EXPENDITURE_ROWS = [
  "Ministers' Allowance",'Transportation','Sun. Sch. Training/Rally','Holy Communion',
  'Donation Gift','Land/Building Project','Revival / Crusade','Furniture','Stationeries / Printing',
  'Retreat / Camp Conference','Medical','Purchase of New Equipment','Welfare','Entertainment',
  'Diesel Fueling (Generator)','Repair - building','Repair - electrical','Utility Bill',
  'Loan Repayment','Honourarium','Audio','Retreat / camping','','',
]
export function currentSunday() {
  const date = new Date()
  date.setHours(12,0,0,0)
  date.setDate(date.getDate() - date.getDay())
  return date.toISOString().slice(0,10)
}
export function emptyReport(reportDate=currentSunday()) {
  return {
    reportDate,
    numerical: NUMERICAL_ROWS.map((service,index)=>({sn:index+1,service,adult:0,children:0,visitor:0,total:0})),
    spiritual: Object.fromEntries(SPIRITUAL_ROWS.map(label=>[label,0])),
    income: INCOME_ROWS.map((name,index)=>({sn:index+1,name,amount:0})),
    expenditure: EXPENDITURE_ROWS.map((name,index)=>({sn:index+1,name,amount:0})),
  }
}
export function normalizeReport(report) {
  const empty=emptyReport(String(report?.reportDate || currentSunday()).slice(0,10))
  const numerical=empty.numerical.map((row,index)=>{
    const saved=Array.isArray(report?.numerical)?report.numerical[index]:null
    const adult=Math.max(0,Math.trunc(Number(saved?.adult)||0))
    const children=Math.max(0,Math.trunc(Number(saved?.children)||0))
    const visitor=Math.max(0,Math.trunc(Number(saved?.visitor)||0))
    return {...row,...saved,adult,children,visitor,total:adult+children+visitor}
  })
  const spiritual={...empty.spiritual}
  for(const label of SPIRITUAL_ROWS) spiritual[label]=Math.max(0,Math.trunc(Number(report?.spiritual?.[label])||0))
  const normalizeMoney=(rows,savedRows)=>rows.map((row,index)=>{
    const saved=Array.isArray(savedRows)?savedRows[index]:null
    const amount=Math.max(0,Math.round((Number(saved?.amount)||0)*100)/100)
    return {...row,...saved,name:saved?.name ?? row.name,amount}
  })
  return {...empty,...report,reportDate:String(report?.reportDate||empty.reportDate).slice(0,10),
    numerical,spiritual,income:normalizeMoney(empty.income,report?.income),
    expenditure:normalizeMoney(empty.expenditure,report?.expenditure)}
}
export function totals(report) {
  const totalCredit=report.income.reduce((sum,row)=>sum+Number(row.amount||0),0)
  const totalExpenditure=report.expenditure.reduce((sum,row)=>sum+Number(row.amount||0),0)
  return {totalCredit,totalExpenditure,balance:totalCredit-totalExpenditure}
}
export function money(value) {
  return CURRENCY+Number(value||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})
}
export function dateLabel(value) {
  const date=new Date(String(value).slice(0,10)+'T12:00:00')
  return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric'})
}
export function reportPayload(report) {
  return {
    reportDate:report.reportDate,
    numerical:report.numerical.map(row=>({sn:row.sn,service:row.service,adult:Math.trunc(Number(row.adult)||0),children:Math.trunc(Number(row.children)||0),visitor:Math.trunc(Number(row.visitor)||0)})),
    spiritual:Object.fromEntries(SPIRITUAL_ROWS.map(label=>[label,Math.trunc(Number(report.spiritual[label])||0)])),
    income:report.income.map(row=>({sn:row.sn,name:String(row.name||'').trim(),amount:Math.round((Number(row.amount)||0)*100)/100})),
    expenditure:report.expenditure.map(row=>({sn:row.sn,name:String(row.name||'').trim(),amount:Math.round((Number(row.amount)||0)*100)/100})),
  }
}

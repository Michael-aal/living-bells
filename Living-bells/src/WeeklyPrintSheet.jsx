import { CURRENCY, NUMERICAL_ROWS, SPIRITUAL_ROWS, money, dateLabel } from './weeklyReportConfig'

export default function WeeklyPrintSheet({ report }) {
  if (!report) return null
  const totalCredit = report.income.reduce((sum,row)=>sum+Number(row.amount||0),0)
  const totalExpenditure = report.expenditure.reduce((sum,row)=>sum+Number(row.amount||0),0)
  const balance = totalCredit-totalExpenditure
  return <section className="weekly-print-sheet" aria-label="Printable weekly report">
    <header className="print-header"><strong>FOURSQUARE GOSPEL CHURCH, THE BELLS</strong><span>WEEKLY REPORT FORM</span><small>DATE: {dateLabel(report.reportDate)}</small></header>
    <h3>A. NUMERICAL SECTION (ACTUAL)</h3>
    <table><thead><tr><th>S/N</th><th>Service Type</th><th>Adult</th><th>Children</th><th>Visitor</th><th>Total</th></tr></thead><tbody>
      {report.numerical.map((row,index)=><tr key={row.sn}><td>{index+1}</td><td>{NUMERICAL_ROWS[index]}</td><td>{row.adult}</td><td>{row.children}</td><td>{row.visitor}</td><td>{row.adult+row.children+row.visitor}</td></tr>)}
    </tbody></table>
    <h3>B. SPIRITUAL EXPERIENCES (ACTUAL)</h3>
    <table><tbody>{SPIRITUAL_ROWS.map(label=><tr key={label}><th>{label}</th><td>{report.spiritual[label]||0}</td></tr>)}</tbody></table>
    <h3>C. FINANCE</h3>
    <div className="print-finance-columns">
      <table><thead><tr><th colSpan="2">INCOME</th></tr></thead><tbody>{report.income.map(row=><tr key={row.sn}><td>{row.name||'Custom'}</td><td>{CURRENCY}{Number(row.amount||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}<tr><th>TOTAL CREDIT</th><th>{money(totalCredit)}</th></tr></tbody></table>
      <table><thead><tr><th colSpan="2">EXPENDITURE</th></tr></thead><tbody>{report.expenditure.map(row=><tr key={row.sn}><td>{row.name||'Custom'}</td><td>{CURRENCY}{Number(row.amount||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}<tr><th>TOTAL EXPENDITURE</th><th>{money(totalExpenditure)}</th></tr></tbody></table>
    </div>
    <div className="print-balance">TOTAL BALANCE: {balance>=0?'SURPLUS':'DEFICIT'} {money(Math.abs(balance))}</div>
  </section>
}

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { prisma } from './db.js'

const app = express()
const PORT = Number(process.env.PORT || 5000)
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production'

app.use(cors())
app.use(express.json())

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
}

function authenticate(req, res, next) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Authentication required' })
  try { req.user = jwt.verify(token, JWT_SECRET); next() }
  catch { return res.status(401).json({ message: 'Invalid or expired token' }) }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Admin access is required' })
  next()
}

function requireStaff(req, res, next) {
  if (req.user?.role !== 'STAFF') return res.status(403).json({ message: 'Only staff accounts can record church operations' })
  next()
}

function currentUserId(req) {
  return Number(req.user?.sub)
}

app.get('/api/auth/staff-invitation', async (req, res, next) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase()
    if (!code) return res.status(400).json({ message: 'Staff code is required' })

    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    const invitation = await prisma.staffInvitation.findFirst({
      where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, name: true, email: true, department: true, position: true, expiresAt: true },
    })
    if (!invitation) return res.status(404).json({ message: 'Invalid, expired or already used staff code' })

    res.json(invitation)
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, role = 'STAFF', inviteCode } = req.body
    const normalizedRole = String(role).toUpperCase()

    if (!password) return res.status(400).json({ message: 'Password is required' })
    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' })
    if (!['STAFF', 'ADMIN'].includes(normalizedRole)) return res.status(400).json({ message: 'Role must be STAFF or ADMIN' })

    let registrationName = String(name || '').trim()
    let registrationEmail = String(email || '').trim().toLowerCase()
    let invitation = null

    if (normalizedRole === 'STAFF') {
      const code = String(inviteCode || '').trim().toUpperCase()
      if (!code) return res.status(400).json({ message: 'A staff code is required' })

      const codeHash = crypto.createHash('sha256').update(code).digest('hex')
      invitation = await prisma.staffInvitation.findFirst({
        where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      })
      if (!invitation) return res.status(403).json({ message: 'Invalid, expired or already used staff code' })

      registrationName = invitation.name
      registrationEmail = invitation.email
    } else {
      if (!registrationName || !registrationEmail) return res.status(400).json({ message: 'Name and email are required' })
    }

    if (await prisma.user.findUnique({ where: { email: registrationEmail } })) {
      return res.status(409).json({ message: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(String(password), 12)
    const user = await prisma.user.create({
      data: {
        name: registrationName,
        email: registrationEmail,
        passwordHash,
        role: normalizedRole,
        department: normalizedRole === 'STAFF' ? invitation.department : null,
        position: normalizedRole === 'STAFF' ? invitation.position : null,
        emailVerifiedAt: new Date(),
      },
    })

    if (invitation) {
      await prisma.staffInvitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } })
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      emailVerified: true,
    }

    res.status(201).json({
      message: 'Account created successfully.',
      token: signToken(user),
      user: safeUser,
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    if (!user.isActive) return res.status(401).json({ message: 'This staff account is inactive. Contact an admin.' })

    res.json({
      token: signToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        position: user.position,
        isActive: user.isActive,
        emailVerified: true,
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.user.sub) },
      select: { id: true, name: true, email: true, role: true, department: true },
    })
    if (!user) return res.status(401).json({ message: 'User account not found' })
    res.json({ ...user, emailVerified: true })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/auth/me', authenticate, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim()
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ message: 'Username must be between 2 and 80 characters' })
    }

    const user = await prisma.user.update({
      where: { id: Number(req.user.sub) },
      data: { name },
      select: { id: true, name: true, email: true, role: true },
    })

    res.json({ ...user, emailVerified: true })
  } catch (error) {
    if (error?.code === 'P2025') return res.status(404).json({ message: 'User account not found' })
    next(error)
  }
})

app.use('/api', authenticate)

const OPTION_KINDS = ['ACTIVITY', 'ATTENDANCE', 'FINANCE_INCOME', 'FINANCE_EXPENSE']

app.get('/api/options', async (req, res, next) => {
  try {
    const kind = String(req.query.kind || '').trim().toUpperCase()
    const where = kind ? { kind } : {}
    if (kind && !OPTION_KINDS.includes(kind)) return res.status(400).json({ message: 'Invalid option kind' })
    const options = await prisma.configOption.findMany({ where, orderBy: { name: 'asc' } })
    res.json(options)
  } catch (error) { next(error) }
})

app.post('/api/options', requireStaff, async (req, res, next) => {
  try {
    const kind = String(req.body?.kind || '').trim().toUpperCase()
    const name = String(req.body?.name || '').trim()
    if (!OPTION_KINDS.includes(kind)) return res.status(400).json({ message: 'Invalid option kind' })
    if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Option name must be between 2 and 100 characters' })

    const option = await prisma.configOption.create({
      data: { kind, name, createdById: currentUserId(req) },
    })
    res.status(201).json(option)
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ message: 'That option already exists' })
    next(error)
  }
})
app.delete('/api/options/:id', requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid option id' })
    const option = await prisma.configOption.findUnique({ where: { id } })
    if (!option) return res.status(404).json({ message: 'Option not found' })
    await prisma.configOption.delete({ where: { id } })
    res.json({ message: 'Option deleted', id })
  } catch (error) {
    if (error?.code === 'P2025') return res.status(404).json({ message: 'Option not found' })
    next(error)
  }
})


function currentChurchDate(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const map=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]))
  return new Date(Date.UTC(Number(map.year),Number(map.month)-1,Number(map.day)))
}
function normalizeDay(value){
  const d=new Date(value)
  if(Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()))
}
function daysInclusive(start,end){return Math.round((end-start)/86400000)+1}
async function findReportingWeekForDate(value){
  const day=normalizeDay(value)
  if(!day) return null
  return prisma.reportingWeek.findFirst({
    where:{startDate:{lte:day},endDate:{gte:day}},
    include:{month:true},
    orderBy:{id:'desc'},
  })
}
function monthDays(year,month){
  return new Date(Date.UTC(year,month,0)).getUTCDate()
}
async function validateReportingWeekRange({year,month,weekNumber,startDate,endDate,excludeId=null}){
  if(!Number.isInteger(year)||year<2000||year>2200) return 'A valid reporting year is required'
  if(!Number.isInteger(month)||month<1||month>12) return 'A valid reporting month is required'
  if(!Number.isInteger(weekNumber)||weekNumber<1||weekNumber>5) return 'Week must be between 1 and 5'
  const start=normalizeDay(startDate), end=normalizeDay(endDate)
  if(!start||!end) return 'A valid start and end date are required'
  if(daysInclusive(start,end)!==7) return 'A reporting week must contain exactly 7 days'

  // A week belongs to the calendar month where its 7-day period ends.
  // If the range crosses into a new month, that new month owns the week.
  const expectedYear=end.getUTCFullYear()
  const expectedMonth=end.getUTCMonth()+1
  if(expectedYear!==year||expectedMonth!==month){
    return 'The reporting month must match the month where the reporting week ends'
  }

  const monthRecord=await prisma.reportingMonth.findUnique({
    where:{year_month:{year,month}},
    include:{
      weeks:{
        where:excludeId?{id:{not:excludeId}}:undefined,
        orderBy:{weekNumber:'asc'}
      }
    }
  })
  const weeks=monthRecord?.weeks||[]
  if(weeks.some(w=>start<=w.endDate&&end>=w.startDate)){
    return 'This date range overlaps another reporting week in this month'
  }
  if(weeks.some(w=>w.weekNumber===weekNumber)) return 'That reporting week already exists'
  return null
}
function reportingMonthDto(month){
  const monthStart=new Date(Date.UTC(month.year,month.month-1,1))
  const monthEnd=new Date(Date.UTC(month.year,month.month-1,monthDays(month.year,month.month)))
  const covered=new Set()
  for(const week of month.weeks){
    const start=week.startDate<monthStart?monthStart:week.startDate
    const end=week.endDate>monthEnd?monthEnd:week.endDate
    for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)) covered.add(d.toISOString().slice(0,10))
  }
  const missingDates=[]
  for(let d=new Date(monthStart);d<=monthEnd;d.setUTCDate(d.getUTCDate()+1)){
    const key=d.toISOString().slice(0,10)
    if(!covered.has(key)) missingDates.push(key)
  }
  const totalDays=monthEnd.getUTCDate()
  return {
    ...month,
    weeks:month.weeks.map(w=>({
      id:w.id,
      weekNumber:w.weekNumber,
      startDate:w.startDate.toISOString().slice(0,10),
      endDate:w.endDate.toISOString().slice(0,10),
      status:w.status
    })),
    coverage:{
      totalDays,
      coveredDays:covered.size,
      missingDays:missingDates.length,
      complete:missingDates.length===0,
      missingDates
    }
  }
}

// Reporting calendar
app.get('/api/reporting/current', async (req,res,next)=>{
  try{
    const currentDate=currentChurchDate()
    const week=await findReportingWeekForDate(currentDate)
    if(!week) return res.json({date:currentDate.toISOString().slice(0,10),month:null,week:null,day:currentDate.toLocaleDateString('en-NG',{weekday:'long',timeZone:'UTC'})})
    res.json({
      date:currentDate.toISOString().slice(0,10),
      day:currentDate.toLocaleDateString('en-NG',{weekday:'long',timeZone:'UTC'}),
      month:{id:week.month.id,year:week.month.year,month:week.month.month,status:week.month.status},
      week:{id:week.id,weekNumber:week.weekNumber,startDate:week.startDate.toISOString().slice(0,10),endDate:week.endDate.toISOString().slice(0,10),status:week.status},
    })
  }catch(e){next(e)}
})
app.get('/api/reporting/months', async (req,res,next)=>{
  try{
    const year=Number(req.query.year||currentChurchDate().getUTCFullYear())
    const months=await prisma.reportingMonth.findMany({where:{year},include:{weeks:{orderBy:{weekNumber:'asc'}}},orderBy:{month:'asc'}})
    res.json(months.map(reportingMonthDto))
  }catch(e){next(e)}
})
app.get('/api/reporting/months/:id', async (req,res,next)=>{
  try{
    const id=Number(req.params.id)
    if(!Number.isInteger(id)||id<1)return res.status(400).json({message:'Invalid reporting month id'})
    const month=await prisma.reportingMonth.findUnique({where:{id},include:{weeks:{orderBy:{weekNumber:'asc'}}}})
    if(!month)return res.status(404).json({message:'Reporting month not found'})
    res.json(reportingMonthDto(month))
  }catch(e){next(e)}
})
app.put('/api/reporting/weeks/:id', requireAdmin, async (req,res,next)=>{
  try{
    const id=Number(req.params.id)
    if(!Number.isInteger(id)||id<1)return res.status(400).json({message:'Invalid reporting week id'})
    const existing=await prisma.reportingWeek.findUnique({where:{id}})
    if(!existing)return res.status(404).json({message:'Reporting week not found'})
    const year=Number(req.body.year), month=Number(req.body.month), weekNumber=Number(req.body.weekNumber)
    const error=await validateReportingWeekRange({
      year,month,weekNumber,
      startDate:req.body.startDate,
      endDate:req.body.endDate,
      excludeId:id
    })
    if(error)return res.status(400).json({message:error})
    const start=normalizeDay(req.body.startDate), end=normalizeDay(req.body.endDate)
    const monthRecord=await prisma.reportingMonth.upsert({
      where:{year_month:{year,month}},
      update:{},
      create:{year,month,createdById:currentUserId(req)}
    })
    const week=await prisma.reportingWeek.update({
      where:{id},
      data:{monthId:monthRecord.id,weekNumber,startDate:start,endDate:end}
    })
    if(existing.monthId!==monthRecord.id){
      const oldMonth=await prisma.reportingMonth.findUnique({where:{id:existing.monthId},include:{weeks:{orderBy:{weekNumber:'asc'}}}})
      if(oldMonth?.weeks.length===0) await prisma.reportingMonth.delete({where:{id:oldMonth.id}})
    }
    const full=await prisma.reportingMonth.findUnique({where:{id:monthRecord.id},include:{weeks:{orderBy:{weekNumber:'asc'}}}})
    res.json(reportingMonthDto(full))
  }catch(e){if(e?.code==='P2002')return res.status(409).json({message:'That reporting week already exists'});next(e)}
})

app.delete('/api/reporting/weeks/:id', requireAdmin, async (req,res,next)=>{
  try{
    const id=Number(req.params.id)
    if(!Number.isInteger(id)||id<1)return res.status(400).json({message:'Invalid reporting week id'})
    const week=await prisma.reportingWeek.findUnique({
      where:{id},
      include:{_count:{select:{activities:true,expenses:true,financialRecords:true,weeklyReports:true}}}
    })
    if(!week)return res.status(404).json({message:'Reporting week not found'})
    const linked=Object.values(week._count).reduce((sum,value)=>sum+value,0)
    if(linked>0)return res.status(409).json({message:'This week contains recorded data and cannot be deleted. Edit the date range instead.'})
    const monthId=week.monthId
    await prisma.reportingWeek.delete({where:{id}})
    const remaining=await prisma.reportingWeek.count({where:{monthId}})
    if(remaining===0)await prisma.reportingMonth.delete({where:{id:monthId}})
    res.json({message:'Calendar week deleted'})
  }catch(e){next(e)}
})

app.post('/api/reporting/weeks', requireAdmin, async (req,res,next)=>{
  try{
    const year=Number(req.body.year), month=Number(req.body.month), weekNumber=Number(req.body.weekNumber)
    const error=await validateReportingWeekRange({year,month,weekNumber,startDate:req.body.startDate,endDate:req.body.endDate})
    if(error)return res.status(400).json({message:error})
    const start=normalizeDay(req.body.startDate), end=normalizeDay(req.body.endDate)
    const monthRecord=await prisma.reportingMonth.upsert({
      where:{year_month:{year,month}},
      update:{},
      create:{year,month,createdById:currentUserId(req)}
    })
    const week=await prisma.reportingWeek.create({data:{monthId:monthRecord.id,weekNumber,startDate:start,endDate:end,createdById:currentUserId(req)}})
    const full=await prisma.reportingMonth.findUnique({where:{id:monthRecord.id},include:{weeks:{orderBy:{weekNumber:'asc'}}}})
    res.status(201).json(reportingMonthDto(full))
  }catch(e){if(e?.code==='P2002')return res.status(409).json({message:'That reporting week already exists'});next(e)}
})
function requireWeeklyReportCreate(req,res,next){if(!['ADMIN','SECRETARY','PASTOR','STAFF'].includes(req.user?.role))return res.status(403).json({message:'Only Admin, Pastor or Secretary accounts can create or edit weekly reports'});next()}
function requireWeeklyReportView(req,res,next){next()}
const WEEKLY_SERVICES=['Pre-Sunday Prayer','Sunday School','Worship Service','Bible Study','House Fellowship','Prayer Meeting','Vigil','Revival Service','Intercessory Prayer','Anointing Service']
const WEEKLY_SPIRITUAL=['No. of Decision','No. of Water Baptism','No. of Healing','No. of Conversion','No. of Holy Spirit Baptism','No. of Deliverance']
const WEEKLY_INCOME_COUNT=24
const WEEKLY_EXPENDITURE_COUNT=24
function normalizeReportDate(value){
  const date=new Date(value)
  if(Number.isNaN(date.getTime())) return null
  date.setUTCHours(0,0,0,0)
  return date
}
function validateWeeklyPayload(body){
  const reportDate=normalizeReportDate(body?.reportDate)
  if(!reportDate)return{error:'A valid report date is required'}
  const numerical=Array.isArray(body?.numerical)?body.numerical:[]
  const income=Array.isArray(body?.income)?body.income:[]
  const expenditure=Array.isArray(body?.expenditure)?body.expenditure:[]
  const spiritual=body?.spiritual&&typeof body.spiritual==='object'?body.spiritual:{}
  if(numerical.length<WEEKLY_SERVICES.length)return{error:'The numerical section must contain at least 10 rows'}
  if(income.length<WEEKLY_INCOME_COUNT)return{error:'The income section must contain at least 24 rows'}
  if(expenditure.length<WEEKLY_EXPENDITURE_COUNT)return{error:'The expenditure section must contain at least 24 rows'}
  const integer=v=>{const n=Number(v);return Number.isInteger(n)&&n>=0?n:null}
  const amount=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&Math.round(n*100)===n*100?n:null}
  const n=numerical.map((r,i)=>{
    const adult=integer(r?.adult),children=integer(r?.children),visitor=integer(r?.visitor)
    const service=String(r?.service||WEEKLY_SERVICES[i]||'').trim()
    if(adult===null||children===null||visitor===null||!service)return null
    return{sn:i+1,service,adult,children,visitor,total:adult+children+visitor}
  })
  if(n.some(row=>!row))return{error:'Attendance values must be whole numbers greater than or equal to 0'}
  const sp={}
  for(const label of WEEKLY_SPIRITUAL){const value=integer(spiritual[label]);if(value===null)return{error:'Spiritual experience values must be whole numbers greater than or equal to 0'};sp[label]=value}
  // Empty custom rows are valid and are ignored. A custom row with an amount
  // must have a name, while every named row must still contain a valid amount.
  const normalizeFinancialRows=(rows)=>{
    const normalized=[]
    for(const r of rows){
      const name=String(r?.name||'').trim()
      const rawAmount=r?.amount
      const value=amount(rawAmount)
      const hasValue=rawAmount!==''&&rawAmount!==null&&rawAmount!==undefined
      if(!name&&!hasValue) continue
      if(!name&&value!==null&&value>0)return null
      if(value===null||!name)return null
      normalized.push({sn:normalized.length+1,name,amount:value})
    }
    return normalized
  }
  const inc=normalizeFinancialRows(income)
  const exp=normalizeFinancialRows(expenditure)
  if(!inc||!exp)return{error:'Financial amounts must be valid non-negative numbers with at most 2 decimal places and every non-zero custom row must have a name'}
  const totalIncome=inc.reduce((sum,row)=>sum+row.amount,0)
  const totalExpenditure=exp.reduce((sum,row)=>sum+row.amount,0)
  return{data:{reportDate,numerical:n,spiritual:sp,income:inc,expenditure:exp,totalIncome,totalExpenditure,balance:totalIncome-totalExpenditure}}
}
const reportDto=r=>({...r,reportDate:r.reportDate.toISOString().slice(0,10),totalIncome:Number(r.totalIncome),totalExpenditure:Number(r.totalExpenditure),balance:Number(r.balance)})
app.get('/api/weekly-reports',requireWeeklyReportView,async(req,res,next)=>{
 try{
  const where={},search=String(req.query.search||'').trim(),month=String(req.query.month||''),year=String(req.query.year||'')
  if(/^\d{4}-\d{2}$/.test(month)){const[y,m]=month.split('-').map(Number);where.reportDate={gte:new Date(Date.UTC(y,m-1,1)),lt:new Date(Date.UTC(y,m,1))}}
  else if(/^\d{4}$/.test(year)){const y=Number(year);where.reportDate={gte:new Date(Date.UTC(y,0,1)),lt:new Date(Date.UTC(y+1,0,1))}}
  else if(search){const d=normalizeReportDate(search);if(d){const end=new Date(d);end.setUTCDate(end.getUTCDate()+1);where.reportDate={gte:d,lt:end}}}
  const rows=await prisma.weeklyReport.findMany({where,orderBy:{reportDate:'desc'},include:{createdBy:{select:{id:true,name:true,email:true,role:true}}}})
  res.json(rows.map(reportDto))
 }catch(e){next(e)}
})
app.get('/api/weekly-reports/:id',requireWeeklyReportView,async(req,res,next)=>{
 try{const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({message:'Invalid report id'});const r=await prisma.weeklyReport.findUnique({where:{id},include:{createdBy:{select:{id:true,name:true,email:true,role:true}}}});if(!r)return res.status(404).json({message:'Weekly report not found'});res.json(reportDto(r))}catch(e){next(e)}
})
function sameWeeklyReport(a,b){
 return a.reportDate.getTime()===b.reportDate.getTime()
  && JSON.stringify(a.numerical)===JSON.stringify(b.numerical)
  && JSON.stringify(a.spiritual)===JSON.stringify(b.spiritual)
  && JSON.stringify(a.income)===JSON.stringify(b.income)
  && JSON.stringify(a.expenditure)===JSON.stringify(b.expenditure)
  && Number(a.totalIncome)===Number(b.totalIncome)
  && Number(a.totalExpenditure)===Number(b.totalExpenditure)
  && Number(a.balance)===Number(b.balance)
}

app.post('/api/weekly-reports',requireWeeklyReportCreate,async(req,res,next)=>{
 try{
  const v=validateWeeklyPayload(req.body);if(v.error)return res.status(400).json({message:v.error})
  const d=v.data
  const clientRequestId=String(req.get('X-Client-Request-Id')||'').trim().slice(0,120)||null

  if(clientRequestId){
   const previous=await prisma.weeklyReport.findUnique({where:{clientRequestId},include:{createdBy:{select:{id:true,name:true,email:true,role:true}}}})
   if(previous)return res.status(200).json({...reportDto(previous),duplicate:true,idempotent:true})
  }

  const reportingWeek=await findReportingWeekForDate(d.reportDate)
  const r=await prisma.weeklyReport.create({
   data:{...d,reportingWeekId:reportingWeek?.id||null,createdById:currentUserId(req),clientRequestId},
   include:{createdBy:{select:{id:true,name:true,email:true,role:true}}},
  })
  res.status(201).json(reportDto(r))
 }catch(e){
  if(e?.code==='P2002'){
   const existing=await prisma.weeklyReport.findUnique({where:{reportDate:validateWeeklyPayload(req.body).data.reportDate},include:{createdBy:{select:{id:true,name:true,email:true,role:true}}}}).catch(()=>null)
   if(existing){
    const submitted=validateWeeklyPayload(req.body).data
    if(sameWeeklyReport(existing,submitted))return res.status(200).json({...reportDto(existing),duplicate:true})
    return res.status(409).json({message:'A weekly report already exists for that date with different data.',conflict:true,existing:reportDto(existing)})
   }
   return res.status(409).json({message:'This offline submission was already processed.',duplicate:true})
  }
  next(e)
 }
})
app.put('/api/weekly-reports/:id',requireWeeklyReportCreate,async(req,res,next)=>{
 try{
  const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({message:'Invalid report id'})
  const v=validateWeeklyPayload(req.body);if(v.error)return res.status(400).json({message:v.error})
  const reportingWeek=await findReportingWeekForDate(v.data.reportDate)
  const r=await prisma.weeklyReport.update({where:{id},data:{...v.data,reportingWeekId:reportingWeek?.id||null},include:{createdBy:{select:{id:true,name:true,email:true,role:true}}}})
  res.json(reportDto(r))
 }catch(e){if(e?.code==='P2025')return res.status(404).json({message:'Weekly report not found'});if(e?.code==='P2002')return res.status(409).json({message:'A weekly report already exists for that date'});next(e)}
})
app.delete('/api/weekly-reports/:id',requireWeeklyReportCreate,async(req,res,next)=>{
 try{const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({message:'Invalid report id'});await prisma.weeklyReport.delete({where:{id}});res.json({message:'Weekly report deleted'})}catch(e){if(e?.code==='P2025')return res.status(404).json({message:'Weekly report not found'});next(e)}
})

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected', service: 'living-bells-backend' })
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected', service: 'living-bells-backend' })
  }
})

app.get('/api/dashboard', async (req, res, next) => {
  try {
    const staffOnly = req.user.role === 'STAFF'
    const userId = currentUserId(req)
    const [attendance, expenses, activities, finances] = await Promise.all([
      prisma.attendance.findMany({
        where: staffOnly ? { recordedById: userId } : undefined,
        include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: staffOnly ? { recordedById: userId } : undefined,
        include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.activity.findMany({
        where: staffOnly ? { recordedById: userId } : undefined,
        include: { recordedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.financialRecord.findMany({
        where: staffOnly ? { recordedById: userId } : undefined,
        include: { recordedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { recordDate: 'desc' },
      }),
    ])
    res.json({ attendance, expenses, activities, finances })
  } catch (error) { next(error) }
})

app.get('/api/activities', async (req, res, next) => {
  try {
    res.json(await prisma.activity.findMany({
      where: req.user.role === 'STAFF' ? { recordedById: currentUserId(req) } : undefined,
      include: { recordedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { date: 'desc' },
    }))
  } catch (error) { next(error) }
})

app.post('/api/activities', requireStaff, async (req, res, next) => {
  try {
    const { name, type, date } = req.body
    const activityDate = new Date(date)
    const reportingWeek = await findReportingWeekForDate(activityDate)
    if (!name?.trim() || Number.isNaN(activityDate.getTime())) return res.status(400).json({ message: 'Valid name and date are required' })
    const activity = await prisma.activity.create({ data: { name: name.trim(), type: type?.trim() || null, date: activityDate, reportingWeekId: reportingWeek?.id || null, recordedById: currentUserId(req) }, include: { recordedBy: { select: { id: true, name: true, email: true } } } })
    res.status(201).json(activity)
  } catch (error) { next(error) }
})

app.put('/api/activities/:id', requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { name, type, date } = req.body
    const activityDate = new Date(date)
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid activity id' })
    if (!name?.trim() || Number.isNaN(activityDate.getTime())) return res.status(400).json({ message: 'Valid name and date are required' })

    const existing = await prisma.activity.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: 'Activity not found' })
    if (existing.recordedById !== currentUserId(req)) return res.status(403).json({ message: 'You can only edit your own activities' })

    const activity = await prisma.activity.update({
      where: { id },
      data: { name: name.trim(), type: type?.trim() || null, date: activityDate, reportingWeekId: (await findReportingWeekForDate(activityDate))?.id || null },
      include: { recordedBy: { select: { id: true, name: true, email: true } } },
    })
    res.json(activity)
  } catch (error) { next(error) }
})

app.delete('/api/activities/:id', requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid activity id' })
    const activity = await prisma.activity.findUnique({ where: { id }, select: { id: true, recordedById: true } })
    if (!activity) return res.status(404).json({ message: 'Activity not found' })
    if (activity.recordedById !== currentUserId(req) && req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'You can only delete your own activities' })
    await prisma.activity.delete({ where: { id } })
    res.json({ message: 'Activity deleted', id })
  } catch (error) { next(error) }
})

app.get('/api/attendance', async (req, res, next) => {
  try {
    res.json(await prisma.attendance.findMany({
      where: req.user.role === 'STAFF' ? { recordedById: currentUserId(req) } : undefined,
      include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }))
  } catch (error) { next(error) }
})

app.post('/api/attendance', requireStaff, async (req, res, next) => {
  try {
    const { activityId, service, date, groups = {} } = req.body
    const id = Number(activityId)
    let activity

    if (Number.isInteger(id) && id > 0) {
      activity = await prisma.activity.findUnique({ where: { id } })
      if (!activity) return res.status(404).json({ message: 'Activity not found' })
      if (activity.recordedById !== currentUserId(req)) return res.status(403).json({ message: 'You can only record attendance for your own activities' })
    } else {
      const activityDate = new Date(date)
      if (!service?.trim() || Number.isNaN(activityDate.getTime())) return res.status(400).json({ message: 'Valid service and date are required' })
      activity = await prisma.activity.create({ data: { name: service.trim(), type: 'service', date: activityDate, reportingWeekId: (await findReportingWeekForDate(activityDate))?.id || null, recordedById: currentUserId(req) } })
    }

    const value = (group, gender) => Math.max(0, Number(groups?.[group]?.[gender] || 0))

    const attendance = await prisma.attendance.upsert({
      where: { activityId: activity.id },
      update: {
        childrenMale: value('Children', 'male'),
        childrenFemale: value('Children', 'female'),
        teenagersMale: value('Teenagers', 'male'),
        teenagersFemale: value('Teenagers', 'female'),
        youthMale: value('Youth', 'male'),
        youthFemale: value('Youth', 'female'),
        adultsMale: value('Adults', 'male'),
        adultsFemale: value('Adults', 'female'),
        recordedById: currentUserId(req),
      },
      create: {
        activityId: activity.id,
        recordedById: Number(req.user.sub),
        childrenMale: value('Children', 'male'),
        childrenFemale: value('Children', 'female'),
        teenagersMale: value('Teenagers', 'male'),
        teenagersFemale: value('Teenagers', 'female'),
        youthMale: value('Youth', 'male'),
        youthFemale: value('Youth', 'female'),
        adultsMale: value('Adults', 'male'),
        adultsFemale: value('Adults', 'female'),
      },
      include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } },
    })

    res.status(201).json(attendance)
  } catch (error) { next(error) }
})

app.delete('/api/attendance/:id', requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid attendance id' })
    const attendance = await prisma.attendance.findUnique({ where: { id }, select: { id: true, recordedById: true } })
    if (!attendance) return res.status(404).json({ message: 'Attendance record not found' })
    if (attendance.recordedById !== currentUserId(req) && req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'You can only delete your own attendance records' })
    await prisma.attendance.delete({ where: { id } })
    res.json({ message: 'Attendance record deleted', id })
  } catch (error) { next(error) }
})

app.get('/api/expenses', async (req, res, next) => {
  try {
    res.json(await prisma.expense.findMany({
      where: req.user.role === 'STAFF' ? { recordedById: currentUserId(req) } : undefined,
      include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { date: 'desc' },
    }))
  } catch (error) { next(error) }
})

app.post('/api/expenses', requireStaff, async (req, res, next) => {
  try {
    const { activityId, description, title, category = 'General', amount, date } = req.body
    const expenseDate = new Date(date)
    const reportingWeek = await findReportingWeekForDate(expenseDate)
    const numericAmount = Number(amount)
    if (!(description || title)?.trim() || !Number.isFinite(numericAmount) || numericAmount < 0 || Number.isNaN(expenseDate.getTime())) {
      return res.status(400).json({ message: 'Valid description, non-negative amount and date are required' })
    }
    const linkedActivityId = activityId ? Number(activityId) : null
    if (linkedActivityId !== null) {
      if (!Number.isInteger(linkedActivityId) || linkedActivityId <= 0) return res.status(400).json({ message: 'Invalid activity id' })
      const activity = await prisma.activity.findUnique({ where: { id: linkedActivityId }, select: { id: true, recordedById: true } })
      if (!activity) return res.status(404).json({ message: 'Activity not found' })
      if (activity.recordedById !== currentUserId(req)) return res.status(403).json({ message: 'You can only attach expenses to your own activities' })
    }
    const expense = await prisma.expense.create({
      data: {
        activityId: linkedActivityId,
        description: (description || title).trim(),
        category: String(category || 'General').trim() || 'General',
        amount: numericAmount,
        reportingWeekId: reportingWeek?.id || null,
        recordedById: currentUserId(req),
        date: expenseDate,
      },
      include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } },
    })
    res.status(201).json(expense)
  } catch (error) { next(error) }
})


app.get('/api/finances', async (req, res, next) => {
  try {
    const records = await prisma.financialRecord.findMany({
      where: ownRecordFilter(req),
      include: { recordedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { recordDate: 'desc' },
    })
    res.json(records)
  } catch (error) { next(error) }
})

app.post('/api/finances', requireStaff, async (req, res, next) => {
  try {
    const { type, category, amount, description, recordDate } = req.body
    const normalizedType = String(type || '').toUpperCase()
    const normalizedCategory = String(category || '').trim()
    const value = Number(amount)
    const date = new Date(recordDate)
    const reportingWeek = await findReportingWeekForDate(date)
    if (!['INCOME', 'EXPENSE'].includes(normalizedType)) return res.status(400).json({ message: 'Type must be INCOME or EXPENSE' })
    if (!normalizedCategory) return res.status(400).json({ message: 'Category is required' })
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Amount must be greater than zero' })
    if (Number.isNaN(date.getTime())) return res.status(400).json({ message: 'A valid transaction date is required' })
    const record = await prisma.financialRecord.create({
      data: { type: normalizedType, category: normalizedCategory, amount: value, description: String(description || '').trim() || null, recordDate: date, reportingWeekId: reportingWeek?.id || null, recordedById: Number(req.user.sub) },
      include: { recordedBy: { select: { id: true, name: true, email: true } } },
    })
    res.status(201).json(record)
  } catch (error) { next(error) }
})

app.delete('/api/finances/:id', requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid finance record id' })
    const record = await prisma.financialRecord.findUnique({ where: { id }, select: { id: true, recordedById: true } })
    if (!record) return res.status(404).json({ message: 'Finance record not found' })
    if (record.recordedById !== currentUserId(req) && req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'You can only delete your own finance records' })
    await prisma.financialRecord.delete({ where: { id } })
    res.json({ message: 'Finance record deleted', id })
  } catch (error) { next(error) }
})

app.post('/api/admin/staff/invitations', requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const department = String(req.body.department || '').trim()
    const position = String(req.body.position || '').trim()
    const allowedDepartments = ['Media', 'Technical', 'Security', 'Secretary', 'Others']

    if (name.length < 2 || !email || !email.includes('@') || !allowedDepartments.includes(department) || position.length < 2) {
      return res.status(400).json({ message: 'Name, valid email, department and position are required' })
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return res.status(409).json({ message: 'An account with this email already exists' })
    }

    const code = crypto.randomBytes(5).toString('hex').toUpperCase()
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    await prisma.staffInvitation.updateMany({ where: { email, usedAt: null }, data: { expiresAt: new Date() } })

    const invitation = await prisma.staffInvitation.create({
      data: { name, email, department, position, codeHash, invitedById: currentUserId(req), expiresAt },
    })

    res.status(201).json({
      message: 'Staff invitation created successfully',
      invitation: { id: invitation.id, name, email, department, position, code, expiresAt, usedAt: null, status: 'Unused' },
    })
  } catch (error) { next(error) }
})

app.get('/api/admin/staff/invitations', requireAdmin, async (_req, res, next) => {
  try {
    const invitations = await prisma.staffInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, department: true, expiresAt: true, usedAt: true, createdAt: true },
    })
    res.json(invitations.map(item => ({
      ...item,
      status: item.usedAt ? 'Used' : item.expiresAt <= new Date() ? 'Expired' : 'Unused',
    })))
  } catch (error) { next(error) }
})

app.get('/api/admin/staff/count', requireAdmin, async (_req, res, next) => {
  try {
    const [active, pending] = await Promise.all([
      prisma.user.count({ where: { role: 'STAFF', isActive: true } }),
      prisma.staffInvitation.count({ where: { usedAt: null, expiresAt: { gt: new Date() } } }),
    ])
    res.json({ active, pending, total: active + pending })
  } catch (error) { next(error) }
})

app.get('/api/admin/staff', requireAdmin, async (_req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF' },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, email: true, role: true, department: true, position: true, isActive: true, emailVerifiedAt: true, createdAt: true,
        _count: { select: { recordedActivities: true, recordedAttendances: true, recordedExpenses: true, financialRecords: true, weeklyReportsCreated: true, staffReviews: true } },
      },
    })
    res.json(staff.map(item => ({
      ...item,
      emailVerified: Boolean(item.emailVerifiedAt),
      recordCount: item._count.recordedActivities + item._count.recordedAttendances + item._count.recordedExpenses + item._count.financialRecords + item._count.weeklyReportsCreated,
      reviewCount: item._count.staffReviews,
      _count: undefined,
    })))
  } catch (error) { next(error) }
})

app.patch('/api/admin/staff/:staffId/status', requireAdmin, async (req, res, next) => {
  try {
    const staffId = Number(req.params.staffId)
    if (!Number.isInteger(staffId)) return res.status(400).json({ message: 'Invalid staff id' })
    const isActive = Boolean(req.body?.isActive)
    const staff = await prisma.user.findFirst({ where: { id: staffId, role: 'STAFF' }, select: { id: true, isActive: true } })
    if (!staff) return res.status(404).json({ message: 'Staff member not found' })
    const updated = await prisma.user.update({ where: { id: staffId }, data: { isActive }, select: { id: true, isActive: true } })
    res.json(updated)
  } catch (error) { next(error) }
})

app.delete('/api/admin/staff/:staffId', requireAdmin, async (req, res, next) => {
  try {
    const staffId = Number(req.params.staffId)
    if (!Number.isInteger(staffId)) return res.status(400).json({ message: 'Invalid staff id' })
    const staff = await prisma.user.findFirst({ where: { id: staffId, role: 'STAFF' }, select: { id: true, name: true } })
    if (!staff) return res.status(404).json({ message: 'Staff member not found' })
    await prisma.user.delete({ where: { id: staffId } })
    res.json({ message: 'Staff account permanently deleted', id: staffId })
  } catch (error) { next(error) }
})

app.get('/api/admin/staff/:staffId/reviews', requireAdmin, async (req, res, next) => {
  try {
    const staffId = Number(req.params.staffId)
    if (!Number.isInteger(staffId)) return res.status(400).json({ message: 'Invalid staff id' })
    const staff = await prisma.user.findFirst({ where: { id: staffId, role: 'STAFF' }, select: { id: true } })
    if (!staff) return res.status(404).json({ message: 'Staff member not found' })
    const reviews = await prisma.sundayReview.findMany({
      where: { staffId },
      include: { admin: { select: { id: true, name: true, email: true } } },
      orderBy: { reviewDate: 'desc' },
    })
    res.json(reviews)
  } catch (error) { next(error) }
})

app.post('/api/admin/staff/:staffId/reviews', requireAdmin, async (req, res, next) => {
  try {
    const staffId = Number(req.params.staffId)
    const reviewDate = new Date(req.body.reviewDate)
    const rating = String(req.body.rating || '').toUpperCase()
    const comment = String(req.body.comment || '').trim() || null
    if (!Number.isInteger(staffId) || Number.isNaN(reviewDate.getTime())) return res.status(400).json({ message: 'Valid staff and Sunday review date are required' })
    if (reviewDate.getDay() !== 0) return res.status(400).json({ message: 'Sunday reviews must use a Sunday date' })
    if (!['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'BAD'].includes(rating)) return res.status(400).json({ message: 'Rating must be Excellent, Good, Fair, Poor or Bad' })

    const staff = await prisma.user.findFirst({ where: { id: staffId, role: 'STAFF' } })
    if (!staff) return res.status(404).json({ message: 'Staff member not found' })

    const review = await prisma.sundayReview.upsert({
      where: { staffId_reviewDate: { staffId, reviewDate } },
      update: { rating, comment, adminId: Number(req.user.sub) },
      create: { staffId, adminId: Number(req.user.sub), reviewDate, rating, comment },
      include: { staff: { select: { id: true, name: true, email: true } }, admin: { select: { id: true, name: true, email: true } } },
    })
    res.status(201).json(review)
  } catch (error) { next(error) }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Internal server error' })
})

const server = app.listen(PORT, () => {
  console.log(`Living Bells backend running on http://localhost:${PORT}`)
})

const shutdown = async () => {
  await prisma.$disconnect()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

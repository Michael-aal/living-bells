import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './db.js'

const app = express()
const PORT = Number(process.env.PORT || 5000)
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production'
const ADMIN_REGISTRATION_KEY = process.env.ADMIN_REGISTRATION_KEY || ''

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

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, role = 'STAFF', adminKey } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedRole = String(role).toUpperCase()

    if (!name?.trim() || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }
    if (!['STAFF', 'ADMIN'].includes(normalizedRole)) {
      return res.status(400).json({ message: 'Role must be STAFF or ADMIN' })
    }
    if (normalizedRole === 'ADMIN' && (!ADMIN_REGISTRATION_KEY || adminKey !== ADMIN_REGISTRATION_KEY)) {
      return res.status(403).json({ message: 'A valid admin registration key is required' })
    }
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
      return res.status(409).json({ message: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(String(password), 12)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: normalizedRole,
        // Email verification is intentionally not required. Registration activates
        // the account immediately and login is the authentication check.
        emailVerifiedAt: new Date(),
      },
    })

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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

    res.json({
      token: signToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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
      select: { id: true, name: true, email: true, role: true },
    })
    if (!user) return res.status(401).json({ message: 'User account not found' })
    res.json({ ...user, emailVerified: true })
  } catch (error) {
    next(error)
  }
})

app.use('/api', authenticate)

function requireWeeklyReportCreate(req,res,next){if(!['ADMIN','SECRETARY'].includes(req.user?.role))return res.status(403).json({message:'Only Admin or Secretary accounts can create or edit weekly reports'});next()}
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
  if(numerical.length!==WEEKLY_SERVICES.length)return{error:'The numerical section must contain exactly 10 rows'}
  if(income.length!==WEEKLY_INCOME_COUNT)return{error:'The income section must contain exactly 24 rows'}
  if(expenditure.length!==WEEKLY_EXPENDITURE_COUNT)return{error:'The expenditure section must contain exactly 24 rows'}
  const integer=v=>{const n=Number(v);return Number.isInteger(n)&&n>=0?n:null}
  const amount=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&Math.round(n*100)===n*100?n:null}
  const n=numerical.map((r,i)=>{
    const adult=integer(r?.adult),children=integer(r?.children),visitor=integer(r?.visitor)
    if(adult===null||children===null||visitor===null)return null
    return{sn:i+1,service:WEEKLY_SERVICES[i],adult,children,visitor,total:adult+children+visitor}
  })
  if(n.some(row=>!row))return{error:'Attendance values must be whole numbers greater than or equal to 0'}
  const sp={}
  for(const label of WEEKLY_SPIRITUAL){const value=integer(spiritual[label]);if(value===null)return{error:'Spiritual experience values must be whole numbers greater than or equal to 0'};sp[label]=value}
  const inc=income.map((r,i)=>{const value=amount(r?.amount);if(value===null)return null;return{sn:i+1,name:String(r?.name||'').trim(),amount:value}})
  const exp=expenditure.map((r,i)=>{const value=amount(r?.amount);if(value===null)return null;return{sn:i+1,name:String(r?.name||'').trim(),amount:value}})
  if(inc.some(row=>!row)||exp.some(row=>!row))return{error:'Financial amounts must be valid non-negative numbers with at most 2 decimal places'}
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
app.post('/api/weekly-reports',requireWeeklyReportCreate,async(req,res,next)=>{
 try{
  const v=validateWeeklyPayload(req.body);if(v.error)return res.status(400).json({message:v.error})
  const d=v.data
  const r=await prisma.weeklyReport.upsert({
   where:{reportDate:d.reportDate},
   update:{numerical:d.numerical,spiritual:d.spiritual,income:d.income,expenditure:d.expenditure,totalIncome:d.totalIncome,totalExpenditure:d.totalExpenditure,balance:d.balance},
   create:{...d,createdById:currentUserId(req)},
   include:{createdBy:{select:{id:true,name:true,email:true,role:true}}},
  })
  res.status(201).json(reportDto(r))
 }catch(e){if(e?.code==='P2002')return res.status(409).json({message:'A weekly report already exists for that date. Refresh and try again.'});next(e)}
})
app.put('/api/weekly-reports/:id',requireWeeklyReportCreate,async(req,res,next)=>{
 try{
  const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({message:'Invalid report id'})
  const v=validateWeeklyPayload(req.body);if(v.error)return res.status(400).json({message:v.error})
  const r=await prisma.weeklyReport.update({where:{id},data:v.data,include:{createdBy:{select:{id:true,name:true,email:true,role:true}}}})
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
    if (!name?.trim() || Number.isNaN(activityDate.getTime())) return res.status(400).json({ message: 'Valid name and date are required' })
    const activity = await prisma.activity.create({ data: { name: name.trim(), type: type?.trim() || null, date: activityDate, recordedById: currentUserId(req) }, include: { recordedBy: { select: { id: true, name: true, email: true } } } })
    res.status(201).json(activity)
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
      activity = await prisma.activity.create({ data: { name: service.trim(), type: 'service', date: activityDate, recordedById: currentUserId(req) } })
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
    if (!['INCOME', 'EXPENSE'].includes(normalizedType)) return res.status(400).json({ message: 'Type must be INCOME or EXPENSE' })
    if (!normalizedCategory) return res.status(400).json({ message: 'Category is required' })
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Amount must be greater than zero' })
    if (Number.isNaN(date.getTime())) return res.status(400).json({ message: 'A valid transaction date is required' })
    const record = await prisma.financialRecord.create({
      data: { type: normalizedType, category: normalizedCategory, amount: value, description: String(description || '').trim() || null, recordDate: date, recordedById: Number(req.user.sub) },
      include: { recordedBy: { select: { id: true, name: true, email: true } } },
    })
    res.status(201).json(record)
  } catch (error) { next(error) }
})

app.get('/api/admin/staff', requireAdmin, async (_req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF' },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, email: true, role: true, emailVerifiedAt: true, createdAt: true,
        _count: { select: { recordedActivities: true, recordedAttendances: true, recordedExpenses: true, staffReviews: true } },
      },
    })
    res.json(staff.map(item => ({
      ...item,
      emailVerified: Boolean(item.emailVerifiedAt),
      recordCount: item._count.recordedActivities + item._count.recordedAttendances + item._count.recordedExpenses,
      reviewCount: item._count.staffReviews,
      _count: undefined,
    })))
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

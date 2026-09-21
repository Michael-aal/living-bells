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
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || ''

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

function createRawToken() {
  return crypto.randomBytes(32).toString('hex')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY || !EMAIL_FROM) throw new Error('Email service is not configured')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Email provider error: ${response.status} ${body}`)
  }
}

async function sendVerificationEmail(user, rawToken) {
  const url = `${APP_URL}/?verify=${encodeURIComponent(rawToken)}`
  await sendEmail({
    to: user.email,
    subject: 'Verify your Living Bells email',
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Welcome to Living Bells, ${user.name}</h2><p>Please verify your email address to activate your account.</p><p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#6d28d9;color:#fff;text-decoration:none;border-radius:8px">Verify email</a></p><p>This link expires in 24 hours.</p></div>`,
  })
}

async function sendResetEmail(user, rawToken) {
  const url = `${APP_URL}/?reset=${encodeURIComponent(rawToken)}`
  await sendEmail({
    to: user.email,
    subject: 'Reset your Living Bells password',
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Password reset</h2><p>Hi ${user.name}, use the button below to choose a new Living Bells password.</p><p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#6d28d9;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p></div>`,
  })
}

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, role = 'STAFF' } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedRole = String(role).toUpperCase()
    if (!name?.trim() || !normalizedEmail || !password) return res.status(400).json({ message: 'Name, email and password are required' })
    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' })
    if (!['STAFF', 'ADMIN'].includes(normalizedRole)) return res.status(400).json({ message: 'Role must be STAFF or ADMIN' })
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) return res.status(409).json({ message: 'An account with this email already exists' })

    const passwordHash = await bcrypt.hash(String(password), 12)
    const rawToken = createRawToken()
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: normalizedRole,
        emailVerifyTokenHash: hashToken(rawToken),
        emailVerifyExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    try {
      await sendVerificationEmail(user, rawToken)
    } catch (emailError) {
      await prisma.user.delete({ where: { id: user.id } })
      throw emailError
    }

    res.status(201).json({
      message: 'Account created. Check your email to verify your account before signing in.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: false },
    })
  } catch (error) { next(error) }
})

app.post('/api/auth/verify-email', async (req, res, next) => {
  try {
    const rawToken = String(req.body.token || '')
    if (!rawToken) return res.status(400).json({ message: 'Verification token is required' })

    const user = await prisma.user.findFirst({
      where: {
        emailVerifyTokenHash: hashToken(rawToken),
        emailVerifyExpiresAt: { gt: new Date() },
      },
    })
    if (!user) return res.status(400).json({ message: 'This verification link is invalid or expired' })

    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null, emailVerifyExpiresAt: null },
    })
    res.json({ message: 'Email verified successfully. You can now sign in.', user: { id: verifiedUser.id, name: verifiedUser.name, email: verifiedUser.email, role: verifiedUser.role, emailVerified: true } })
  } catch (error) { next(error) }
})

app.post('/api/auth/resend-verification', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (user && !user.emailVerifiedAt) {
      const rawToken = createRawToken()
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifyTokenHash: hashToken(rawToken), emailVerifyExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      })
      await sendVerificationEmail(user, rawToken)
    }

    res.json({ message: 'If that account exists and is not verified, a verification email has been sent.' })
  } catch (error) { next(error) }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '')
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' })
    if (!user.emailVerifiedAt) return res.status(403).json({ message: 'Please verify your email before signing in', code: 'EMAIL_NOT_VERIFIED' })
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: true } })
  } catch (error) { next(error) }
})

app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (user && user.emailVerifiedAt) {
      const rawToken = createRawToken()
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: hashToken(rawToken), resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      })
      await sendResetEmail(user, rawToken)
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' })
  } catch (error) { next(error) }
})

app.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const rawToken = String(req.body.token || '')
    const password = String(req.body.password || '')
    if (!rawToken || !password) return res.status(400).json({ message: 'Reset token and new password are required' })
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' })

    const user = await prisma.user.findFirst({
      where: { resetTokenHash: hashToken(rawToken), resetTokenExpiresAt: { gt: new Date() } },
    })
    if (!user) return res.status(400).json({ message: 'This password reset link is invalid or expired' })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    })
    res.json({ message: 'Password reset successfully. You can now sign in.' })
  } catch (error) { next(error) }
})

app.get('/api/auth/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.user.sub) }, select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true } })
    if (!user) return res.status(401).json({ message: 'User account not found' })
    res.json({ ...user, emailVerified: Boolean(user.emailVerifiedAt) })
  } catch (error) { next(error) }
})

app.use('/api', authenticate)

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected', service: 'living-bells-backend' })
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected', service: 'living-bells-backend' })
  }
})

app.get('/api/dashboard', async (_req, res, next) => {
  try {
    const [attendance, expenses, activities] = await Promise.all([
      prisma.attendance.findMany({ include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.expense.findMany({ include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } }, orderBy: { date: 'desc' } }),
      prisma.activity.findMany({ include: { recordedBy: { select: { id: true, name: true, email: true } } }, orderBy: { date: 'desc' } }),
    ])
    res.json({ attendance, expenses, activities })
  } catch (error) { next(error) }
})

app.get('/api/activities', async (_req, res, next) => {
  try { res.json(await prisma.activity.findMany({ include: { recordedBy: { select: { id: true, name: true, email: true } } }, orderBy: { date: 'desc' } })) }
  catch (error) { next(error) }
})

app.post('/api/activities', requireStaff, async (req, res, next) => {
  try {
    const { name, type, date } = req.body
    if (!name || !date) return res.status(400).json({ message: 'name and date are required' })
    const activity = await prisma.activity.create({ data: { name, type: type || null, date: new Date(date), recordedById: Number(req.user.sub) }, include: { recordedBy: { select: { id: true, name: true, email: true } } } })
    res.status(201).json(activity)
  } catch (error) { next(error) }
})

app.get('/api/attendance', async (_req, res, next) => {
  try { res.json(await prisma.attendance.findMany({ include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } })) }
  catch (error) { next(error) }
})

app.post('/api/attendance', requireStaff, async (req, res, next) => {
  try {
    const { activityId, service, date, groups = {} } = req.body
    const id = Number(activityId)
    let activity

    if (Number.isInteger(id) && id > 0) {
      activity = await prisma.activity.findUnique({ where: { id } })
      if (!activity) return res.status(404).json({ message: 'Activity not found' })
    } else {
      if (!service || !date) return res.status(400).json({ message: 'service and date are required' })
      activity = await prisma.activity.create({ data: { name: service, type: 'service', date: new Date(date), recordedById: Number(req.user.sub) } })
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
        recordedById: Number(req.user.sub),
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

app.get('/api/expenses', async (_req, res, next) => {
  try { res.json(await prisma.expense.findMany({ include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } }, orderBy: { date: 'desc' } })) }
  catch (error) { next(error) }
})

app.post('/api/expenses', requireStaff, async (req, res, next) => {
  try {
    const { activityId, description, title, category = 'General', amount, date } = req.body
    if (!(description || title) || amount === undefined || !date) {
      return res.status(400).json({ message: 'description, amount and date are required' })
    }
    const expense = await prisma.expense.create({
      data: {
        activityId: activityId ? Number(activityId) : null,
        description: description || title,
        category,
        amount: Number(amount),
        recordedById: Number(req.user.sub),
        date: new Date(date),
      },
      include: { activity: true, recordedBy: { select: { id: true, name: true, email: true } } },
    })
    res.status(201).json(expense)
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

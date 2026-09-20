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

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, role = 'STAFF', adminKey } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedRole = String(role).toUpperCase()
    if (!name?.trim() || !normalizedEmail || !password) return res.status(400).json({ message: 'Name, email and password are required' })
    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' })
    if (!['STAFF', 'ADMIN'].includes(normalizedRole)) return res.status(400).json({ message: 'Role must be STAFF or ADMIN' })
    if (normalizedRole === 'ADMIN' && (!ADMIN_REGISTRATION_KEY || adminKey !== ADMIN_REGISTRATION_KEY)) return res.status(403).json({ message: 'A valid admin registration key is required' })
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) return res.status(409).json({ message: 'An account with this email already exists' })
    const passwordHash = await bcrypt.hash(String(password), 12)
    const user = await prisma.user.create({ data: { name: name.trim(), email: normalizedEmail, passwordHash, role: normalizedRole } })
    res.status(201).json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (error) { next(error) }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '')
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' })
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (error) { next(error) }
})

app.get('/api/auth/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.user.sub) }, select: { id: true, name: true, email: true, role: true } })
    if (!user) return res.status(401).json({ message: 'User account not found' })
    res.json(user)
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
      prisma.attendance.findMany({ include: { activity: true }, orderBy: { createdAt: 'desc' } }),
      prisma.expense.findMany({ include: { activity: true }, orderBy: { date: 'desc' } }),
      prisma.activity.findMany({ orderBy: { date: 'desc' } }),
    ])
    res.json({ attendance, expenses, activities })
  } catch (error) { next(error) }
})

app.get('/api/activities', async (_req, res, next) => {
  try { res.json(await prisma.activity.findMany({ orderBy: { date: 'desc' } })) }
  catch (error) { next(error) }
})

app.post('/api/activities', async (req, res, next) => {
  try {
    const { name, type, date } = req.body
    if (!name || !date) return res.status(400).json({ message: 'name and date are required' })
    const activity = await prisma.activity.create({ data: { name, type: type || null, date: new Date(date) } })
    res.status(201).json(activity)
  } catch (error) { next(error) }
})

app.get('/api/attendance', async (_req, res, next) => {
  try { res.json(await prisma.attendance.findMany({ include: { activity: true }, orderBy: { createdAt: 'desc' } })) }
  catch (error) { next(error) }
})

app.post('/api/attendance', async (req, res, next) => {
  try {
    const { activityId, service, date, groups = {} } = req.body
    const id = Number(activityId)
    let activity

    if (Number.isInteger(id) && id > 0) {
      activity = await prisma.activity.findUnique({ where: { id } })
      if (!activity) return res.status(404).json({ message: 'Activity not found' })
    } else {
      if (!service || !date) return res.status(400).json({ message: 'service and date are required' })
      activity = await prisma.activity.create({ data: { name: service, type: 'service', date: new Date(date) } })
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
      },
      create: {
        activityId: activity.id,
        childrenMale: value('Children', 'male'),
        childrenFemale: value('Children', 'female'),
        teenagersMale: value('Teenagers', 'male'),
        teenagersFemale: value('Teenagers', 'female'),
        youthMale: value('Youth', 'male'),
        youthFemale: value('Youth', 'female'),
        adultsMale: value('Adults', 'male'),
        adultsFemale: value('Adults', 'female'),
      },
      include: { activity: true },
    })

    res.status(201).json(attendance)
  } catch (error) { next(error) }
})

app.get('/api/expenses', async (_req, res, next) => {
  try { res.json(await prisma.expense.findMany({ include: { activity: true }, orderBy: { date: 'desc' } })) }
  catch (error) { next(error) }
})

app.post('/api/expenses', async (req, res, next) => {
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
        date: new Date(date),
      },
      include: { activity: true },
    })
    res.status(201).json(expense)
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

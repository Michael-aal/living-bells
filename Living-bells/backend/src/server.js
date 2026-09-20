import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { prisma } from './db.js'

const app = express()
const PORT = Number(process.env.PORT || 5000)

app.use(cors())
app.use(express.json())

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

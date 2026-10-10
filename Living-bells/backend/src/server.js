import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { prisma } from './db.js'

const app = express()
const PORT = Number(process.env.PORT || 5000)
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production'
const DEV_RECOVERY_SECRET = String(process.env.DEV_ADMIN_RECOVERY_SECRET || '').trim()
const DEV_RECOVERY_ENCRYPTION_KEY = crypto.createHash('sha256').update(String(process.env.DEV_RECOVERY_ENCRYPTION_KEY || JWT_SECRET)).digest()
const tenantContext = new AsyncLocalStorage()
const TENANT_MODELS = new Set(['Activity', 'Attendance', 'Expense', 'SundayReview', 'AttendanceRecord', 'AttendanceEntry', 'FinancialRecord', 'WeeklyReport', 'ReportingMonth', 'ReportingWeek', 'ConfigOption', 'StaffInvitation', 'SupportTicket'])

function addChurchToData(data, churchId) {
  if (Array.isArray(data)) return data.map(item => addChurchToData(item, churchId))
  if (!data || typeof data !== 'object') return data
  const result = { ...data }
  if ('create' in result) result.create = addChurchToData(result.create, churchId)
  if ('createMany' in result) result.createMany = addChurchToData(result.createMany, churchId)
  if ('update' in result && typeof result.update === 'object') result.update = addChurchToData(result.update, churchId)
  if ('upsert' in result && typeof result.upsert === 'object') result.upsert = addChurchToData(result.upsert, churchId)
  if ('data' in result && typeof result.data === 'object') result.data = addChurchToData(result.data, churchId)
  result.churchId = churchId
  return result
}

prisma.$use(async (params, next) => {
  const context = tenantContext.getStore()
  if (!context?.churchId || context.role === 'DEV' || !TENANT_MODELS.has(params.model)) return next(params)
  const churchId = context.churchId
  const scopedActions = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'])
  if (scopedActions.has(params.action)) {
    params.args ||= {}
    params.args.where = { ...(params.args.where || {}), churchId }
  }
  if (params.action === 'create') {
    params.args ||= {}
    params.args.data = addChurchToData(params.args.data, churchId)
  }
  if (params.action === 'createMany') {
    params.args ||= {}
    params.args.data = addChurchToData(params.args.data, churchId)
  }
  if (params.action === 'upsert') {
    params.args ||= {}
    params.args.create = addChurchToData(params.args.create, churchId)
    if (params.args.update) params.args.update = addChurchToData(params.args.update, churchId)
  }
  if (['update', 'updateMany'].includes(params.action) && params.args?.data) {
    params.args.data = addChurchToData(params.args.data, churchId)
  }
  return next(params)
})

function generateRecoveryKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(20)
  let raw = ''
  for (const byte of bytes) raw += alphabet[byte % alphabet.length]
  return `LB-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`
}

function encryptRecoveryKey(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', DEV_RECOVERY_ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { encrypted: Buffer.concat([encrypted, tag]).toString('base64'), nonce: iv.toString('base64') }
}

function decryptRecoveryKey(encrypted, nonce) {
  const packed = Buffer.from(encrypted, 'base64')
  const iv = Buffer.from(nonce, 'base64')
  const tag = packed.subarray(packed.length - 16)
  const ciphertext = packed.subarray(0, packed.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', DEV_RECOVERY_ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

async function getOrCreateDevRecoveryKey(user) {
  if (user.devRecoveryKeyEncrypted && user.devRecoveryKeyNonce) {
    return { key: decryptRecoveryKey(user.devRecoveryKeyEncrypted, user.devRecoveryKeyNonce), created: false }
  }
  const key = generateRecoveryKey()
  const encrypted = encryptRecoveryKey(key)
  await prisma.user.update({
    where: { id: user.id },
    data: { devRecoveryKeyEncrypted: encrypted.encrypted, devRecoveryKeyNonce: encrypted.nonce, devRecoveryKeyCreatedAt: new Date() },
  })
  return { key, created: true }
}

async function createDevRecoveryNotification(userId) {
  return prisma.notification.create({
    data: {
      userId,
      type: 'SECURITY',
      title: 'Developer recovery key ready',
      message: 'Your encrypted recovery key is available in Developer Console → Security. Keep it private and use it if you need to recover this account.',
      metadata: { action: 'developer-recovery-key' },
    },
  })
}

app.use(cors())
app.use(express.json())

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Authentication required' })
  try {
    const claims = jwt.verify(token, JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: Number(claims.sub) }, select: { id: true, name: true, email: true, role: true, churchId: true, isActive: true } })
    if (!user || !user.isActive) return res.status(401).json({ message: 'Account is inactive or no longer exists' })
    if (user.role !== 'DEV' && !user.churchId) return res.status(403).json({ message: 'This account is not assigned to a church. Contact support.' })
    req.user = { ...claims, sub: user.id, name: user.name, email: user.email, role: user.role, churchId: user.churchId }
    tenantContext.run({ churchId: user.churchId, role: user.role }, next)
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') return res.status(401).json({ message: 'Invalid or expired token' })
    next(error)
  }
}

function requireAdmin(req, res, next) {
  if (!['ADMIN', 'DEV'].includes(req.user?.role)) return res.status(403).json({ message: 'Admin or developer access is required' })
  next()
}

function requireDev(req, res, next) {
  if (req.user?.role !== 'DEV') return res.status(403).json({ message: 'Developer access is required' })
  next()
}

async function requireDevReady(req, res, next) {
  if (req.user?.role !== 'DEV') return res.status(403).json({ message: 'Developer access is required' })
  const user = await prisma.user.findUnique({ where: { id: Number(req.user.sub) }, select: { mustChangePassword: true } })
  if (!user) return res.status(401).json({ message: 'Developer account not found' })
  if (user.mustChangePassword) return res.status(403).json({ message: 'Complete developer password setup before accessing the console', code: 'DEV_PASSWORD_SETUP_REQUIRED' })
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

app.post('/api/auth/dev-bootstrap', async (req, res, next) => {
  try {
    const bootstrapKey = String(process.env.DEV_BOOTSTRAP_KEY || '').trim()
    const suppliedKey = String(req.body?.bootstrapKey || '').trim()
    if (!bootstrapKey || !suppliedKey || suppliedKey !== bootstrapKey) {
      return res.status(403).json({ message: 'Developer bootstrap is not authorized' })
    }

    const existing = await prisma.user.count({ where: { role: 'DEV' } })
    if (existing > 0 && process.env.DEV_BOOTSTRAP_ALLOW_REUSE !== 'true') {
      return res.status(409).json({ message: 'A developer account already exists' })
    }

    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (name.length < 2 || !email.includes('@') || password.length < 8) {
      return res.status(400).json({ message: 'Name, valid email and password of at least 8 characters are required' })
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return res.status(409).json({ message: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'DEV', emailVerifiedAt: new Date(), mustChangePassword: true },
    })

    res.status(201).json({
      message: 'Developer account created successfully',
      token: signToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: true },
    })
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
    if (normalizedRole === 'ADMIN') return res.status(403).json({ message: 'Administrator accounts require an approved church application. Submit an application instead.' })
    if (normalizedRole !== 'STAFF') return res.status(400).json({ message: 'Only invited STAFF accounts can register here' })

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
        position: invitation.position,
        churchId: invitation.churchId,
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
        mustChangePassword: Boolean(user.mustChangePassword),
      },
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/dev-recover', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const recoveryKey = String(req.body?.recoveryKey || '').trim()
    const recoverySecret = String(req.body?.recoverySecret || '')
    const newPassword = String(req.body?.newPassword || '')
    if (!email || (!recoveryKey && !recoverySecret) || newPassword.length < 8) return res.status(400).json({ message: 'Email, recovery key and a password of at least 8 characters are required' })
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.role !== 'DEV') return res.status(404).json({ message: 'Developer account not found' })

    let verified = false
    if (recoveryKey && user.devRecoveryKeyEncrypted && user.devRecoveryKeyNonce) {
      try {
        const storedKey = decryptRecoveryKey(user.devRecoveryKeyEncrypted, user.devRecoveryKeyNonce)
        const left = Buffer.from(storedKey)
        const right = Buffer.from(recoveryKey)
        verified = left.length === right.length && crypto.timingSafeEqual(left, right)
      } catch {}
    }
    if (!verified && DEV_RECOVERY_SECRET && recoverySecret === DEV_RECOVERY_SECRET) verified = true
    if (!verified) return res.status(403).json({ message: 'Developer recovery verification failed' })

    const passwordHash = await bcrypt.hash(newPassword, 12)
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, isActive: true } })
    res.json({ message: 'Developer password reset successfully', token: signToken(updated), user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, emailVerified: true, mustChangePassword: false } })
  } catch (error) { next(error) }
})

app.get('/api/auth/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.user.sub) },
      select: { id: true, name: true, email: true, role: true, department: true, mustChangePassword: true },
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


app.post('/api/church-applications', async (req, res, next) => {
  try {
    const churchName = String(req.body?.churchName || '').trim()
    const applicantName = String(req.body?.applicantName || '').trim()
    const applicantEmail = String(req.body?.applicantEmail || '').trim().toLowerCase()
    const denomination = String(req.body?.denomination || '').trim() || null
    const address = String(req.body?.address || '').trim() || null
    const phone = String(req.body?.phone || '').trim() || null
    if (churchName.length < 2 || applicantName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) {
      return res.status(400).json({ message: 'Church name, applicant name and a valid contact email are required.' })
    }
    const recent = await prisma.churchApplication.findFirst({
      where: { applicantEmail, status: { in: ['PENDING', 'NEEDS_INFO', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, createdAt: true },
    })
    if (recent) return res.status(409).json({ message: 'An application for this email is already being reviewed or awaiting activation.', application: recent })
    const application = await prisma.churchApplication.create({
      data: { churchName, applicantName, applicantEmail, denomination, address, phone },
      select: { id: true, churchName: true, applicantName: true, applicantEmail: true, status: true, createdAt: true },
    })
    const developers = await prisma.user.findMany({ where: { role: 'DEV', isActive: true }, select: { id: true } })
    if (developers.length) await prisma.notification.createMany({
      data: developers.map(user => ({
        userId: user.id,
        type: 'CHURCH_APPLICATION',
        title: 'New church application',
        message: `${churchName} submitted a church registration application.`,
        metadata: { applicationId: application.id, action: 'review-church-application' },
      })),
    })
    res.status(201).json({ message: 'Application submitted. It will remain pending until the Living Bells developer team reviews it.', application })
  } catch (error) { next(error) }
})

app.post('/api/church-applications/activate', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim()
    const password = String(req.body?.password || '')
    if (!token || password.length < 8) return res.status(400).json({ message: 'A valid activation link and password of at least 8 characters are required.' })
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const application = await prisma.churchApplication.findFirst({
      where: { activationTokenHash: tokenHash, status: 'APPROVED', activationExpiresAt: { gt: new Date() }, activatedAt: null },
    })
    if (!application || !application.churchId) return res.status(400).json({ message: 'This activation link is invalid, expired or already used. Contact Living Bells support.' })
    if (await prisma.user.findUnique({ where: { email: application.applicantEmail }, select: { id: true } })) {
      return res.status(409).json({ message: 'An account already exists for this email. Contact support to resolve the application.' })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: { name: application.applicantName, email: application.applicantEmail, passwordHash, role: 'ADMIN', churchId: application.churchId, emailVerifiedAt: new Date() },
      })
      await tx.churchApplication.update({
        where: { id: application.id },
        data: { status: 'ACTIVATED', activatedAt: new Date(), activationTokenHash: null, activationExpiresAt: null },
      })
      return user
    })
    res.status(201).json({
      message: 'Church administrator account activated. You can now sign in.',
      user: { id: result.id, name: result.name, email: result.email, role: result.role, churchId: result.churchId, emailVerified: true },
    })
  } catch (error) { next(error) }
})

app.use('/api', authenticate)

app.post('/api/dev/security/initial-password', authenticate, requireDev, async (req, res, next) => {
  try {
    const newPassword = String(req.body?.newPassword || '')
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' })
    const user = await prisma.user.findUnique({ where: { id: Number(req.user.sub) } })
    if (!user) return res.status(404).json({ message: 'Developer account not found' })
    if (!user.mustChangePassword) return res.status(409).json({ message: 'Initial developer password setup has already been completed' })
    const passwordHash = await bcrypt.hash(newPassword, 12)
    const recovery = await getOrCreateDevRecoveryKey(user)
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } })
    if (recovery.created) await createDevRecoveryNotification(user.id)
    res.json({ message: 'Developer password setup completed', recoveryKey: recovery.key, token: signToken(updated), user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, emailVerified: true, mustChangePassword: false } })
  } catch (error) { next(error) }
})

app.get('/api/dev/security/recovery-key', requireDevReady, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.user.sub) }, select: { id: true, devRecoveryKeyEncrypted: true, devRecoveryKeyNonce: true } })
    if (!user) return res.status(404).json({ message: 'Developer account not found' })
    const recovery = await getOrCreateDevRecoveryKey(user)
    if (recovery.created) await createDevRecoveryNotification(user.id)
    res.json({ recoveryKey: recovery.key })
  } catch (error) { next(error) }
})

app.get('/api/notifications', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({ where: { userId: currentUserId(req) }, orderBy: { createdAt: 'desc' }, take: 50 })
    res.json(notifications)
  } catch (error) { next(error) }
})

app.patch('/api/notifications/:id/read', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const notification = await prisma.notification.updateMany({ where: { id, userId: currentUserId(req) }, data: { readAt: new Date() } })
    if (!notification.count) return res.status(404).json({ message: 'Notification not found' })
    res.json({ message: 'Notification marked as read' })
  } catch (error) { next(error) }
})

app.patch('/api/dev/security/password', requireDevReady, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '')
    const newPassword = String(req.body?.newPassword || '')
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' })
    const user = await prisma.user.findUnique({ where: { id: Number(req.user.sub) } })
    if (!user || user.role !== 'DEV') return res.status(404).json({ message: 'Developer account not found' })
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    res.json({ message: 'Developer password changed successfully' })
  } catch (error) { next(error) }
})

app.get('/api/dev/developers', requireDevReady, async (_req, res, next) => {
  try {
    const developers = await prisma.user.findMany({
      where: { role: 'DEV' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    })
    res.json(developers)
  } catch (error) { next(error) }
})

app.post('/api/dev/developers', requireDevReady, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (name.length < 2 || !email.includes('@') || password.length < 8) {
      return res.status(400).json({ message: 'Name, valid email and password of at least 8 characters are required' })
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return res.status(409).json({ message: 'An account with this email already exists' })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const developer = await prisma.user.create({
      data: { name, email, passwordHash, role: 'DEV', emailVerifiedAt: new Date(), mustChangePassword: true },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, mustChangePassword: true },
    })
    res.status(201).json(developer)
  } catch (error) { next(error) }
})

app.get('/api/dev/overview', requireDevReady, async (_req, res, next) => {
  try {
    const [total, active, staff, admins, developers, activities, attendance, finances, weeklyReports, pendingInvitations, latestReport] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'STAFF' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'DEV' } }),
      prisma.activity.count(),
      prisma.attendance.count(),
      prisma.financialRecord.count(),
      prisma.weeklyReport.count(),
      prisma.staffInvitation.count({ where: { usedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.weeklyReport.findFirst({ orderBy: { reportDate: 'desc' }, select: { reportDate: true, updatedAt: true } }),
    ])

    res.set('Cache-Control', 'no-store')
    res.json({
      users: { total, active, staff, admins, developers },
      pendingInvitations,
      records: { activities, attendance, finances, weeklyReports },
      latestReport,
      source: 'database',
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/dev/users', requireDevReady, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, email: true, role: true, department: true,
        position: true, isActive: true, createdAt: true,
      },
    })
    res.set('Cache-Control', 'no-store')
    res.json({
      users,
      counts: {
        total: users.length,
        active: users.filter(user => user.isActive).length,
        admins: users.filter(user => user.role === 'ADMIN').length,
        staff: users.filter(user => user.role === 'STAFF').length,
        developers: users.filter(user => user.role === 'DEV').length,
      },
      source: 'database',
    })
  } catch (error) {
    next(error)
  }
})

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
  if(!Number.isInteger(year)) return 'A valid reporting year is required'
  if(!Number.isInteger(month)||month<1||month>12) return 'A valid reporting month is required'
  if(!Number.isInteger(weekNumber)||weekNumber<1||weekNumber>5) return 'Week must be between 1 and 5'

  const start=normalizeDay(startDate), end=normalizeDay(endDate)
  if(!start||!end) return 'A valid start and end date are required'
  if(daysInclusive(start,end)!==7) return 'A reporting week must contain exactly 7 days'

  // A week belongs to the calendar month where its seven-day period ends.
  // The year is part of the calendar identity, so 2022 and 2026 are
  // completely independent reporting calendars.
  const expectedYear=end.getUTCFullYear()
  const expectedMonth=end.getUTCMonth()+1
  if(expectedYear!==year||expectedMonth!==month){
    return 'The reporting month must match the month where the reporting week ends'
  }

  // Validate against the actual date range instead of loading a month first.
  // This makes the calendar explicitly date-driven and prevents a historical
  // week from being compared with a week from another year.
  const overlappingWeek=await prisma.reportingWeek.findFirst({
    where:{
      ...(excludeId ? {id:{not:excludeId}} : {}),
      startDate:{lte:end},
      endDate:{gte:start},
    },
    select:{
      id:true,
      weekNumber:true,
      startDate:true,
      endDate:true,
      month:{select:{year:true,month:true}},
    },
  })

  if(overlappingWeek){
    const conflictYear=overlappingWeek.month.year
    const conflictMonth=String(overlappingWeek.month.month).padStart(2,'0')
    return `This date range overlaps Week ${overlappingWeek.weekNumber} (${conflictYear}-${conflictMonth})`
  }

  // Week numbers are scoped to the exact year + month via the existing
  // ReportingMonth/ReportingWeek composite uniqueness constraints.
  const monthRecord=await prisma.reportingMonth.findUnique({
    where:{churchId_year_month:{churchId:Number(req.user.churchId),year,month}},
    select:{id:true},
  })

  if(monthRecord){
    const numberedWeek=await prisma.reportingWeek.findFirst({
      where:{
        monthId:monthRecord.id,
        weekNumber,
        ...(excludeId ? {id:{not:excludeId}} : {}),
      },
      select:{id:true},
    })
    if(numberedWeek) return 'That reporting week already exists'
  }

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
      where:{churchId_year_month:{churchId:Number(req.user.churchId),year,month}},
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
      where:{churchId_year_month:{churchId:Number(req.user.churchId),year,month}},
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
      const hasAmount=rawAmount!==''&&rawAmount!==null&&rawAmount!==undefined
      if(!name&&(!hasAmount||value===0)) continue
      if(!name||value===null)return null
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
   const existing=await prisma.weeklyReport.findFirst({where:{reportDate:validateWeeklyPayload(req.body).data.reportDate},include:{createdBy:{select:{id:true,name:true,email:true,role:true}}}}).catch(()=>null)
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
      data: { name, email, department, position, codeHash, invitedById: currentUserId(req), churchId: req.user.churchId, expiresAt },
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


app.get('/api/dev/church-applications', requireDevReady, async (_req, res, next) => {
  try {
    const applications = await prisma.churchApplication.findMany({
      orderBy: { createdAt: 'desc' },
      include: { church: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true, email: true } } },
    })
    res.set('Cache-Control', 'no-store')
    res.json(applications)
  } catch (error) { next(error) }
})

app.patch('/api/dev/church-applications/:id', requireDevReady, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const action = String(req.body?.action || '').toUpperCase()
    const note = String(req.body?.note || '').trim() || null
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid application id.' })
    if (!['APPROVE', 'REJECT', 'NEEDS_INFO'].includes(action)) return res.status(400).json({ message: 'Action must be APPROVE, REJECT or NEEDS_INFO.' })
    const application = await prisma.churchApplication.findUnique({ where: { id } })
    if (!application) return res.status(404).json({ message: 'Application not found.' })
    if (application.status !== 'PENDING' && application.status !== 'NEEDS_INFO') return res.status(409).json({ message: 'This application has already been decided.' })
    if (action === 'NEEDS_INFO' && !note) return res.status(400).json({ message: 'Add a note describing the information required.' })
    if (action === 'REJECT' && !note) return res.status(400).json({ message: 'A rejection reason is required.' })

    let activationLink = null
    let updated
    if (action === 'APPROVE') {
      const rawToken = crypto.randomBytes(32).toString('base64url')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
      const origin = String(process.env.APP_BASE_URL || 'https://living-bells.vercel.app').replace(/\/$/, '')
      const result = await prisma.$transaction(async tx => {
        const church = await tx.church.create({
          data: { name: application.churchName, denomination: application.denomination, address: application.address, contactEmail: application.applicantEmail, phone: application.phone },
        })
        const next = await tx.churchApplication.update({
          where: { id },
          data: { status: 'APPROVED', reviewNote: note, reviewedById: currentUserId(req), reviewedAt: new Date(), churchId: church.id, activationTokenHash: tokenHash, activationExpiresAt: expiresAt },
        })
        const applicant = await tx.user.findMany({ where: { role: 'DEV', isActive: true }, select: { id: true } })
        if (applicant.length) await tx.notification.createMany({ data: applicant.map(user => ({ userId: user.id, type: 'CHURCH_APPLICATION', title: 'Church application approved', message: `${application.churchName} was approved and is awaiting administrator activation.`, metadata: { applicationId: id } })) })
        return next
      })
      updated = result
      activationLink = `${origin}/?churchActivation=${encodeURIComponent(rawToken)}`
    } else {
      updated = await prisma.churchApplication.update({
        where: { id },
        data: { status: action === 'REJECT' ? 'REJECTED' : 'NEEDS_INFO', reviewNote: note, reviewedById: currentUserId(req), reviewedAt: new Date(), activationTokenHash: null, activationExpiresAt: null },
      })
    }
    res.json({ application: updated, activationLink, activationExpiresAt: updated.activationExpiresAt, message: action === 'APPROVE' ? 'Application approved. Share the one-time activation link securely with the applicant; it expires in 72 hours.' : action === 'REJECT' ? 'Application rejected.' : 'More information requested.' })
  } catch (error) { next(error) }
})

function requireChurchAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Church administrator access is required.' })
  if (!req.user?.churchId) return res.status(403).json({ message: 'This administrator is not assigned to a church.' })
  next()
}

app.get('/api/support/tickets', async (req, res, next) => {
  try {
    if (req.user.role !== 'DEV' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Church administrator access is required.' })
    const where = req.user.role === 'DEV' ? {} : { churchId: req.user.churchId }
    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { church: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } },
    })
    res.json(tickets)
  } catch (error) { next(error) }
})

app.post('/api/support/tickets', requireChurchAdmin, async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim()
    const category = String(req.body?.category || 'BUG').trim().toUpperCase()
    const description = String(req.body?.description || '').trim()
    if (title.length < 4 || description.length < 10 || !['BUG', 'QUESTION', 'ACCESS', 'DATA', 'OTHER'].includes(category)) return res.status(400).json({ message: 'Provide a title, a detailed description and a valid category.' })
    const ticket = await prisma.supportTicket.create({
      data: { churchId: req.user.churchId, createdById: currentUserId(req), title, category, description },
      include: { church: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true, email: true } } },
    })
    const developers = await prisma.user.findMany({ where: { role: 'DEV', isActive: true }, select: { id: true } })
    if (developers.length) await prisma.notification.createMany({ data: developers.map(user => ({ userId: user.id, type: 'SUPPORT_TICKET', title: 'New support ticket', message: `${ticket.church?.name || 'A church'}: ${title}`, metadata: { ticketId: ticket.id } })) })
    res.status(201).json(ticket)
  } catch (error) { next(error) }
})

app.get('/api/support/tickets/:id/messages', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const where = req.user.role === 'DEV' ? { id } : { id, churchId: req.user.churchId }
    const ticket = await prisma.supportTicket.findFirst({ where })
    if (!ticket) return res.status(404).json({ message: 'Support ticket not found.' })
    const messages = await prisma.supportTicketMessage.findMany({
      where: { ticketId: id, ...(req.user.role === 'DEV' ? {} : { internal: false }) },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(messages)
  } catch (error) { next(error) }
})

app.post('/api/support/tickets/:id/messages', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const body = String(req.body?.body || '').trim()
    const internal = req.user.role === 'DEV' && req.body?.internal === true
    if (!Number.isInteger(id) || id < 1 || body.length < 2 || body.length > 8000) return res.status(400).json({ message: 'A message between 2 and 8000 characters is required.' })
    if (!['DEV', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ message: 'Only church administrators and developers can reply.' })
    const ticket = await prisma.supportTicket.findFirst({ where: req.user.role === 'DEV' ? { id } : { id, churchId: req.user.churchId } })
    if (!ticket) return res.status(404).json({ message: 'Support ticket not found.' })
    const message = await prisma.supportTicketMessage.create({ data: { ticketId: id, authorId: currentUserId(req), body, internal } })
    await prisma.supportTicket.update({ where: { id }, data: { status: req.user.role === 'DEV' ? 'WAITING_FOR_CHURCH' : 'IN_PROGRESS' } })
    if (req.user.role === 'DEV') await prisma.notification.create({ data: { userId: ticket.createdById, type: 'SUPPORT_REPLY', title: 'Support replied to your ticket', message: `A developer replied to “${ticket.title}”.`, metadata: { ticketId: id } } })
    res.status(201).json(message)
  } catch (error) { next(error) }
})

app.patch('/api/dev/support/tickets/:id', requireDevReady, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const status = String(req.body?.status || '').toUpperCase()
    const priority = String(req.body?.priority || '').toUpperCase()
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid ticket id.' })
    if (!['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CHURCH', 'RESOLVED', 'CLOSED'].includes(status)) return res.status(400).json({ message: 'Invalid ticket status.' })
    if (priority && !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) return res.status(400).json({ message: 'Invalid priority.' })
    const ticket = await prisma.supportTicket.update({ where: { id }, data: { status, ...(priority ? { priority } : {}) } })
    res.json(ticket)
  } catch (error) { next(error) }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Internal server error' })
})

async function ensureDevAdmin() {
  const email = String(process.env.DEV_ADMIN_EMAIL || 'livingbells@gmail.com').trim().toLowerCase()
  const password = String(process.env.DEV_ADMIN_PASSWORD || 'Living Bells')
  const name = String(process.env.DEV_ADMIN_NAME || 'Living Bells Developer').trim()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role !== 'DEV') {
      console.warn(`DEV_ADMIN_EMAIL is already used by a non-developer account: ${email}`)
    } else if (process.env.DEV_ADMIN_REARM_SETUP === 'true') {
      if (password.length < 8) throw new Error('DEV_ADMIN_PASSWORD must be at least 8 characters')
      const passwordHash = await bcrypt.hash(password, 12)
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, mustChangePassword: true, isActive: true } })
      console.log(`Developer first-login setup re-armed: ${email}`)
    }
    return
  }

  if (password.length < 8) {
    throw new Error('DEV_ADMIN_PASSWORD must be at least 8 characters')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { name, email, passwordHash, role: 'DEV', emailVerifiedAt: new Date(), isActive: true, mustChangePassword: true },
  })
  console.log(`Developer account initialized: ${email}`)
}

const server = app.listen(PORT, async () => {
  try {
    await ensureDevAdmin()
    console.log(`Living Bells backend running on http://localhost:${PORT}`)
  } catch (error) {
    console.error('Developer account initialization failed:', error)
  }
})

const shutdown = async () => {
  await prisma.$disconnect()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

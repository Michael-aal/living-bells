import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma, tenantContext } from '../src/db.js'

const runAs = (churchId, callback) => tenantContext.run({ churchId, role: 'ADMIN' }, callback)
const suffix = randomUUID()
let churchA
let churchB
let userA
let userB
let activityA
let activityB
let ticketA
let ticketB

try {
  churchA = await prisma.church.create({ data: { name: 'Tenant test A ' + suffix } })
  churchB = await prisma.church.create({ data: { name: 'Tenant test B ' + suffix } })
  userA = await prisma.user.create({
    data: { name: 'Tenant A', email: 'tenant-a-' + suffix + '@example.test', passwordHash: 'test-only', role: 'ADMIN', churchId: churchA.id },
  })
  userB = await prisma.user.create({
    data: { name: 'Tenant B', email: 'tenant-b-' + suffix + '@example.test', passwordHash: 'test-only', role: 'ADMIN', churchId: churchB.id },
  })

  activityA = await runAs(churchA.id, () => prisma.activity.create({ data: { name: 'A activity', date: new Date('2026-01-04T00:00:00.000Z') } }))
  activityB = await runAs(churchB.id, () => prisma.activity.create({ data: { name: 'B activity', date: new Date('2026-01-11T00:00:00.000Z') } }))

  ticketA = await prisma.supportTicket.create({
    data: { churchId: churchA.id, createdById: userA.id, title: 'Tenant A ticket', category: 'BUG', description: 'Tenant isolation smoke test ticket A' },
  })
  ticketB = await prisma.supportTicket.create({
    data: { churchId: churchB.id, createdById: userB.id, title: 'Tenant B ticket', category: 'BUG', description: 'Tenant isolation smoke test ticket B' },
  })

  const visibleActivitiesA = await runAs(churchA.id, () => prisma.activity.findMany())
  assert.deepEqual(visibleActivitiesA.map(item => item.id), [activityA.id], 'church A must only list its own activities')

  const foreignActivity = await runAs(churchA.id, () => prisma.activity.findUnique({ where: { id: activityB.id } }))
  assert.equal(foreignActivity, null, 'church A must not fetch church B activity by identifier')

  const attemptedUpdate = await runAs(churchA.id, () => prisma.activity.updateMany({ where: { id: activityB.id }, data: { name: 'cross-tenant mutation' } }))
  assert.equal(attemptedUpdate.count, 0, 'cross-tenant update must match zero records')

  const visibleUsersA = await runAs(churchA.id, () => prisma.user.findMany({ where: { role: 'ADMIN' } }))
  assert.deepEqual(visibleUsersA.map(item => item.id), [userA.id], 'church A admin directory must not include church B users')

  const visibleTicketsA = await runAs(churchA.id, () => prisma.supportTicket.findMany())
  assert.deepEqual(visibleTicketsA.map(item => item.id), [ticketA.id], 'church A must only list its own support tickets')

  const unchangedForeignActivity = await prisma.activity.findUnique({ where: { id: activityB.id } })
  assert.equal(unchangedForeignActivity.name, 'B activity', 'cross-tenant update must not alter church B data')

  process.stdout.write('Tenant isolation smoke test passed: list, identifier lookup, update, users, and support tickets.\n')
} finally {
  const ticketIds = [ticketA?.id, ticketB?.id].filter(Boolean)
  if (ticketIds.length) await prisma.supportTicket.deleteMany({ where: { id: { in: ticketIds } } })
  const activityIds = [activityA?.id, activityB?.id].filter(Boolean)
  if (activityIds.length) await prisma.activity.deleteMany({ where: { id: { in: activityIds } } })
  const userIds = [userA?.id, userB?.id].filter(Boolean)
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  const churchIds = [churchA?.id, churchB?.id].filter(Boolean)
  if (churchIds.length) await prisma.church.deleteMany({ where: { id: { in: churchIds } } })
  await prisma.$disconnect()
}

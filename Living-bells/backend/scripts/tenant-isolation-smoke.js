import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma, tenantContext } from '../src/db.js'

const runAs = (churchId, callback) => tenantContext.run({ churchId, role: 'ADMIN' }, async () => await callback())
const suffix = randomUUID()
let churchA
let churchB
let userA
let userB
let activityA
let activityB
let ticketA
let ticketB
let attendanceRecordA
let attendanceRecordB
let monthA
let monthB
let optionA
let optionB
let reportA
let reportB

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

  ticketA = await runAs(churchA.id, () => prisma.supportTicket.create({
    data: { createdBy: { connect: { id: userA.id } }, title: 'Tenant A ticket', category: 'BUG', description: 'Tenant isolation smoke test ticket A' },
  }))
  ticketB = await runAs(churchB.id, () => prisma.supportTicket.create({
    data: { createdBy: { connect: { id: userB.id } }, title: 'Tenant B ticket', category: 'BUG', description: 'Tenant isolation smoke test ticket B' },
  }))

  const visibleActivitiesA = await runAs(churchA.id, () => prisma.activity.findMany())
  assert.deepEqual(visibleActivitiesA.map(item => item.id), [activityA.id], 'church A must only list its own activities')

  const foreignActivity = await runAs(churchA.id, () => prisma.activity.findUnique({ where: { id: activityB.id } }))
  assert.equal(foreignActivity, null, 'church A must not fetch church B activity by identifier')

  await assert.rejects(
    () => runAs(churchA.id, () => prisma.expense.create({ data: { activityId: activityB.id, description: 'foreign link attempt', category: 'TEST', amount: 1, date: new Date('2026-01-04T00:00:00.000Z') } })),
    error => error?.code === 'TENANT_RELATION_FORBIDDEN',
    'church A must not connect an expense to church B activity',
  )

  const attemptedUpdate = await runAs(churchA.id, () => prisma.activity.updateMany({ where: { id: activityB.id }, data: { name: 'cross-tenant mutation' } }))
  assert.equal(attemptedUpdate.count, 0, 'cross-tenant update must match zero records')

  const visibleUsersA = await runAs(churchA.id, () => prisma.user.findMany({ where: { role: 'ADMIN' } }))
  assert.deepEqual(visibleUsersA.map(item => item.id), [userA.id], 'church A admin directory must not include church B users')

  const visibleTicketsA = await runAs(churchA.id, () => prisma.supportTicket.findMany())
  assert.deepEqual(visibleTicketsA.map(item => item.id), [ticketA.id], 'church A must only list its own support tickets')

  const sharedDate = new Date('2026-02-01T00:00:00.000Z')
  attendanceRecordA = await runAs(churchA.id, () => prisma.attendanceRecord.create({ data: { serviceDate: sharedDate } }))
  attendanceRecordB = await runAs(churchB.id, () => prisma.attendanceRecord.create({ data: { serviceDate: sharedDate } }))
  monthA = await runAs(churchA.id, () => prisma.reportingMonth.create({ data: { year: 2026, month: 2 } }))
  monthB = await runAs(churchB.id, () => prisma.reportingMonth.create({ data: { year: 2026, month: 2 } }))
  optionA = await runAs(churchA.id, () => prisma.configOption.create({ data: { kind: 'SMOKE_TEST', name: 'Shared option' } }))
  optionB = await runAs(churchB.id, () => prisma.configOption.create({ data: { kind: 'SMOKE_TEST', name: 'Shared option' } }))
  reportA = await runAs(churchA.id, () => prisma.weeklyReport.create({ data: { reportDate: sharedDate, numerical: {}, spiritual: {}, income: {}, expenditure: {}, totalIncome: 0, totalExpenditure: 0, balance: 0, clientRequestId: 'shared-' + suffix } }))
  reportB = await runAs(churchB.id, () => prisma.weeklyReport.create({ data: { reportDate: sharedDate, numerical: {}, spiritual: {}, income: {}, expenditure: {}, totalIncome: 0, totalExpenditure: 0, balance: 0, clientRequestId: 'shared-' + suffix } }))

  const unchangedForeignActivity = await prisma.activity.findUnique({ where: { id: activityB.id } })
  assert.equal(unchangedForeignActivity.name, 'B activity', 'cross-tenant update must not alter church B data')

  process.stdout.write('Tenant isolation smoke test passed: list, identifier lookup, update, users, and support tickets.\n')
} finally {
  const ticketIds = [ticketA?.id, ticketB?.id].filter(Boolean)
  if (ticketIds.length) await prisma.supportTicket.deleteMany({ where: { id: { in: ticketIds } } })
  const reportIds = [reportA?.id, reportB?.id].filter(Boolean)
  if (reportIds.length) await prisma.weeklyReport.deleteMany({ where: { id: { in: reportIds } } })
  const attendanceRecordIds = [attendanceRecordA?.id, attendanceRecordB?.id].filter(Boolean)
  if (attendanceRecordIds.length) await prisma.attendanceRecord.deleteMany({ where: { id: { in: attendanceRecordIds } } })
  const monthIds = [monthA?.id, monthB?.id].filter(Boolean)
  if (monthIds.length) await prisma.reportingMonth.deleteMany({ where: { id: { in: monthIds } } })
  const optionIds = [optionA?.id, optionB?.id].filter(Boolean)
  if (optionIds.length) await prisma.configOption.deleteMany({ where: { id: { in: optionIds } } })
  const activityIds = [activityA?.id, activityB?.id].filter(Boolean)
  if (activityIds.length) await prisma.activity.deleteMany({ where: { id: { in: activityIds } } })
  const userIds = [userA?.id, userB?.id].filter(Boolean)
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  const churchIds = [churchA?.id, churchB?.id].filter(Boolean)
  if (churchIds.length) await prisma.church.deleteMany({ where: { id: { in: churchIds } } })
  await prisma.$disconnect()
}

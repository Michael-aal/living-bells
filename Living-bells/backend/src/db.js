import { AsyncLocalStorage } from 'node:async_hooks'
import { PrismaClient } from '@prisma/client'

export const tenantContext = new AsyncLocalStorage()

const tenantModels = new Set([
  'User', 'Activity', 'Attendance', 'Expense', 'SundayReview',
  'AttendanceRecord', 'AttendanceEntry', 'FinancialRecord', 'WeeklyReport',
  'ReportingMonth', 'ReportingWeek', 'ConfigOption', 'StaffInvitation',
  'SupportTicket',
])

function addChurchRelation(data, churchId) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const result = { ...data }
  delete result.churchId
  result.church = { connect: { id: churchId } }
  return result
}

function addChurchScalar(data, churchId) {
  if (Array.isArray(data)) return data.map(item => addChurchScalar(item, churchId))
  if (!data || typeof data !== 'object') return data
  return { ...data, churchId }
}

const basePrisma = new PrismaClient()

// Tenant isolation lives at the database client boundary so every ordinary
// model query receives the authenticated church scope, not a client-supplied ID.
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = tenantContext.getStore()
        if (!context?.churchId || context.role === 'DEV' || !tenantModels.has(model)) return query(args)
        const churchId = Number(context.churchId)
        const scoped = { ...args }
        const scopedOperations = new Set([
          'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
          'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany',
          'delete', 'deleteMany', 'upsert',
        ])
        if (scopedOperations.has(operation)) scoped.where = { ...(scoped.where || {}), churchId }
        if (operation === 'create') scoped.data = addChurchRelation(scoped.data, churchId)
        if (operation === 'createMany') scoped.data = addChurchScalar(scoped.data, churchId)
        if (operation === 'upsert') {
          scoped.create = addChurchRelation(scoped.create, churchId)
          if (scoped.update) scoped.update = addChurchRelation(scoped.update, churchId)
        }
        if ((operation === 'update' || operation === 'updateMany') && scoped.data) {
          scoped.data = addChurchScalar(scoped.data, churchId)
        }
        return query(scoped)
      },
    },
  },
})

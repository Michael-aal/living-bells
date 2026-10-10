import { AsyncLocalStorage } from 'node:async_hooks'
import { PrismaClient } from '@prisma/client'

export const tenantContext = new AsyncLocalStorage()

const tenantModels = new Set([
  'User', 'Activity', 'Attendance', 'Expense', 'SundayReview',
  'AttendanceRecord', 'AttendanceEntry', 'FinancialRecord', 'WeeklyReport',
  'ReportingMonth', 'ReportingWeek', 'ConfigOption', 'StaffInvitation',
  'SupportTicket',
])

function addChurchToData(data, churchId) {
  if (Array.isArray(data)) return data.map(item => addChurchToData(item, churchId))
  if (!data || typeof data !== 'object') return data
  const result = { ...data }
  for (const key of ['create', 'createMany', 'update', 'upsert', 'data']) {
    if (result[key] && typeof result[key] === 'object') result[key] = addChurchToData(result[key], churchId)
  }
  result.churchId = churchId
  return result
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
        if (operation === 'create') scoped.data = addChurchToData(scoped.data, churchId)
        if (operation === 'createMany') scoped.data = addChurchToData(scoped.data, churchId)
        if (operation === 'upsert') {
          scoped.create = addChurchToData(scoped.create, churchId)
          if (scoped.update) scoped.update = addChurchToData(scoped.update, churchId)
        }
        if ((operation === 'update' || operation === 'updateMany') && scoped.data) {
          scoped.data = addChurchToData(scoped.data, churchId)
        }
        return query(scoped)
      },
    },
  },
})

import { AsyncLocalStorage } from 'node:async_hooks'
import { PrismaClient } from '@prisma/client'

export const tenantContext = new AsyncLocalStorage()

const tenantModels = new Set([
  'User', 'Activity', 'Attendance', 'Expense', 'SundayReview',
  'AttendanceRecord', 'AttendanceEntry', 'FinancialRecord', 'WeeklyReport',
  'ReportingMonth', 'ReportingWeek', 'ConfigOption', 'StaffInvitation',
  'SupportTicket',
])

const relationForeignKeys = {
  Activity: { reportingWeekId: 'reportingWeek', recordedById: 'recordedBy' },
  Attendance: { activityId: 'activity', recordedById: 'recordedBy' },
  Expense: { activityId: 'activity', reportingWeekId: 'reportingWeek', recordedById: 'recordedBy' },
  SundayReview: { staffId: 'staff', adminId: 'admin' },
  AttendanceRecord: { recordedById: 'recordedBy' },
  AttendanceEntry: { attendanceRecordId: 'attendanceRecord' },
  FinancialRecord: { reportingWeekId: 'reportingWeek', recordedById: 'recordedBy' },
  WeeklyReport: { reportingWeekId: 'reportingWeek', createdById: 'createdBy' },
  ReportingMonth: { createdById: 'createdBy' },
  ReportingWeek: { monthId: 'month', createdById: 'createdBy' },
  ConfigOption: { createdById: 'createdBy' },
  StaffInvitation: { invitedById: 'invitedBy' },
  SupportTicket: { createdById: 'createdBy' },
}

function addChurchRelation(data, churchId, model, operation) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const result = { ...data }
  delete result.churchId
  for (const [foreignKey, relationName] of Object.entries(relationForeignKeys[model] || {})) {
    if (!(foreignKey in result)) continue
    const foreignId = result[foreignKey]
    delete result[foreignKey]
    if (foreignId == null) {
      if (operation === 'update') result[relationName] = { disconnect: true }
    } else {
      result[relationName] = { connect: { id: foreignId } }
    }
  }
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
        if (operation === 'create') scoped.data = addChurchRelation(scoped.data, churchId, model, 'create')
        if (operation === 'createMany') scoped.data = addChurchScalar(scoped.data, churchId)
        if (operation === 'upsert') {
          scoped.create = addChurchRelation(scoped.create, churchId, model, 'create')
          if (scoped.update) scoped.update = addChurchRelation(scoped.update, churchId, model, 'update')
        }
        if (operation === 'update' && scoped.data) scoped.data = addChurchRelation(scoped.data, churchId, model, 'update')
        if (operation === 'updateMany' && scoped.data) scoped.data = addChurchScalar(scoped.data, churchId)
        return query(scoped)
      },
    },
  },
})

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
  Activity: { reportingWeekId: { relation: 'reportingWeek', model: 'ReportingWeek' }, recordedById: { relation: 'recordedBy', model: 'User' } },
  Attendance: { activityId: { relation: 'activity', model: 'Activity' }, recordedById: { relation: 'recordedBy', model: 'User' } },
  Expense: { activityId: { relation: 'activity', model: 'Activity' }, reportingWeekId: { relation: 'reportingWeek', model: 'ReportingWeek' }, recordedById: { relation: 'recordedBy', model: 'User' } },
  SundayReview: { staffId: { relation: 'staff', model: 'User' }, adminId: { relation: 'admin', model: 'User' } },
  AttendanceRecord: { recordedById: { relation: 'recordedBy', model: 'User' } },
  AttendanceEntry: { attendanceRecordId: { relation: 'attendanceRecord', model: 'AttendanceRecord' } },
  FinancialRecord: { reportingWeekId: { relation: 'reportingWeek', model: 'ReportingWeek' }, recordedById: { relation: 'recordedBy', model: 'User' } },
  WeeklyReport: { reportingWeekId: { relation: 'reportingWeek', model: 'ReportingWeek' }, createdById: { relation: 'createdBy', model: 'User' } },
  ReportingMonth: { createdById: { relation: 'createdBy', model: 'User' } },
  ReportingWeek: { monthId: { relation: 'month', model: 'ReportingMonth' }, createdById: { relation: 'createdBy', model: 'User' } },
  ConfigOption: { createdById: { relation: 'createdBy', model: 'User' } },
  StaffInvitation: { invitedById: { relation: 'invitedBy', model: 'User' } },
  SupportTicket: { createdById: { relation: 'createdBy', model: 'User' } },
}

function addChurchRelation(data, churchId, model, operation) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const result = { ...data }
  delete result.churchId
  for (const [foreignKey, target] of Object.entries(relationForeignKeys[model] || {})) {
    if (!(foreignKey in result)) continue
    const foreignId = result[foreignKey]
    delete result[foreignKey]
    if (foreignId == null) {
      if (operation === 'update') result[target.relation] = { disconnect: true }
    } else {
      result[target.relation] = { connect: { id: foreignId } }
    }
  }
  result.church = { connect: { id: churchId } }
  return result
}
 
async function validateTenantRelations(model, data, churchId) {
  if (Array.isArray(data)) {
    for (const item of data) await validateTenantRelations(model, item, churchId)
    return
  }
  if (!data || typeof data !== 'object') return
  for (const [foreignKey, target] of Object.entries(relationForeignKeys[model] || {})) {
    const relationValue = data[target.relation]
    const foreignId = data[foreignKey] ?? relationValue?.connect?.id
    if (foreignId == null) continue
    const delegateName = target.model[0].toLowerCase() + target.model.slice(1)
    const record = await basePrisma[delegateName].findFirst({
      where: { id: Number(foreignId), churchId },
      select: { id: true },
    })
    if (!record) {
      const error = new Error('A related record does not belong to this church.')
      error.code = 'TENANT_RELATION_FORBIDDEN'
      error.status = 403
      throw error
    }
  }
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
        if (operation === 'create') {
          scoped.data = addChurchRelation(scoped.data, churchId, model, 'create')
          await validateTenantRelations(model, scoped.data, churchId)
        }
        if (operation === 'createMany') {
          scoped.data = addChurchScalar(scoped.data, churchId)
          await validateTenantRelations(model, scoped.data, churchId)
        }
        if (operation === 'upsert') {
          scoped.create = addChurchRelation(scoped.create, churchId, model, 'create')
          if (scoped.update) scoped.update = addChurchRelation(scoped.update, churchId, model, 'update')
          await validateTenantRelations(model, scoped.create, churchId)
          await validateTenantRelations(model, scoped.update, churchId)
        }
        if (operation === 'update' && scoped.data) {
          scoped.data = addChurchRelation(scoped.data, churchId, model, 'update')
          await validateTenantRelations(model, scoped.data, churchId)
        }
        if (operation === 'updateMany' && scoped.data) {
          scoped.data = addChurchScalar(scoped.data, churchId)
          await validateTenantRelations(model, scoped.data, churchId)
        }
        return query(scoped)
      },
    },
  },
})

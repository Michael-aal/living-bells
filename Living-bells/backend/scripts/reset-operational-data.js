import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

if (process.env.CONFIRM_RESET !== 'YES') {
  console.error('Refusing to reset data. Re-run with CONFIRM_RESET=YES.')
  process.exit(1)
}

async function resetOperationalData() {
  await prisma.$transaction(async tx => {
    // Preserve User and ConfigOption records. Clear only church operational/history data.
    await tx.attendanceEntry.deleteMany({})
    await tx.attendanceRecord.deleteMany({})
    await tx.weeklyReport.deleteMany({})
    await tx.financialRecord.deleteMany({})
    await tx.expense.deleteMany({})
    await tx.attendance.deleteMany({})
    await tx.activity.deleteMany({})
    await tx.sundayReview.deleteMany({})
    await tx.staffInvitation.deleteMany({})
    await tx.reportingWeek.deleteMany({})
    await tx.reportingMonth.deleteMany({})
  }, { timeout: 30000 })

  console.log('Operational data reset complete. Users and configuration options were preserved.')
}

resetOperationalData()
  .catch(error => {
    console.error('Operational data reset failed:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

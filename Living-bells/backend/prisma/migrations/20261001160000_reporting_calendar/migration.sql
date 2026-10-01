-- Custom seven-day reporting calendar
CREATE TABLE "ReportingMonth" (
  "id" SERIAL NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReportingMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportingMonth_year_month_key" ON "ReportingMonth"("year", "month");
CREATE INDEX "ReportingMonth_year_month_idx" ON "ReportingMonth"("year", "month");

CREATE TABLE "ReportingWeek" (
  "id" SERIAL NOT NULL,
  "monthId" INTEGER NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReportingWeek_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportingWeek_monthId_weekNumber_key" ON "ReportingWeek"("monthId", "weekNumber");
CREATE INDEX "ReportingWeek_startDate_endDate_idx" ON "ReportingWeek"("startDate", "endDate");
CREATE INDEX "ReportingWeek_monthId_idx" ON "ReportingWeek"("monthId");

ALTER TABLE "Activity" ADD COLUMN "reportingWeekId" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "reportingWeekId" INTEGER;
ALTER TABLE "FinancialRecord" ADD COLUMN "reportingWeekId" INTEGER;
ALTER TABLE "WeeklyReport" ADD COLUMN "reportingWeekId" INTEGER;

CREATE INDEX "Activity_reportingWeekId_idx" ON "Activity"("reportingWeekId");
CREATE INDEX "Expense_reportingWeekId_idx" ON "Expense"("reportingWeekId");
CREATE INDEX "FinancialRecord_reportingWeekId_idx" ON "FinancialRecord"("reportingWeekId");
CREATE INDEX "WeeklyReport_reportingWeekId_idx" ON "WeeklyReport"("reportingWeekId");

ALTER TABLE "ReportingMonth" ADD CONSTRAINT "ReportingMonth_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportingWeek" ADD CONSTRAINT "ReportingWeek_monthId_fkey"
  FOREIGN KEY ("monthId") REFERENCES "ReportingMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportingWeek" ADD CONSTRAINT "ReportingWeek_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_reportingWeekId_fkey"
  FOREIGN KEY ("reportingWeekId") REFERENCES "ReportingWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_reportingWeekId_fkey"
  FOREIGN KEY ("reportingWeekId") REFERENCES "ReportingWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_reportingWeekId_fkey"
  FOREIGN KEY ("reportingWeekId") REFERENCES "ReportingWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_reportingWeekId_fkey"
  FOREIGN KEY ("reportingWeekId") REFERENCES "ReportingWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

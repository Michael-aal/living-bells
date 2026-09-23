ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SECRETARY';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PASTOR';

CREATE TABLE "WeeklyReport" (
  "id" SERIAL NOT NULL,
  "reportDate" TIMESTAMP(3) NOT NULL,
  "numerical" JSONB NOT NULL,
  "spiritual" JSONB NOT NULL,
  "income" JSONB NOT NULL,
  "expenditure" JSONB NOT NULL,
  "totalIncome" DECIMAL(14,2) NOT NULL,
  "totalExpenditure" DECIMAL(14,2) NOT NULL,
  "balance" DECIMAL(14,2) NOT NULL,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WeeklyReport_reportDate_idx" ON "WeeklyReport"("reportDate");
CREATE INDEX "WeeklyReport_createdById_idx" ON "WeeklyReport"("createdById");
CREATE INDEX "WeeklyReport_reportDate_createdAt_idx" ON "WeeklyReport"("reportDate","createdAt");

-- Expand-only multi-church foundation. Existing rows are preserved and assigned to The Bells.
CREATE TYPE "ChurchApplicationStatus" AS ENUM ('PENDING', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'ACTIVATED');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_CHURCH', 'RESOLVED', 'CLOSED');

CREATE TABLE "Church" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "denomination" TEXT,
  "address" TEXT,
  "contactEmail" TEXT,
  "phone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Church_name_idx" ON "Church"("name");

INSERT INTO "Church" ("name", "denomination", "createdAt", "updatedAt")
VALUES ('Foursquare Gospel Church, The Bells', 'Foursquare Gospel Church', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "User" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "Activity" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "Attendance" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "SundayReview" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "AttendanceEntry" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "FinancialRecord" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "WeeklyReport" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "ReportingMonth" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "ReportingWeek" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "ConfigOption" ADD COLUMN "churchId" INTEGER;
ALTER TABLE "StaffInvitation" ADD COLUMN "churchId" INTEGER;

UPDATE "User" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1) WHERE "role" <> 'DEV';
UPDATE "Activity" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "Attendance" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "Expense" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "SundayReview" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "AttendanceRecord" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "AttendanceEntry" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "FinancialRecord" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "WeeklyReport" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "ReportingMonth" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "ReportingWeek" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "ConfigOption" SET "churchId" = (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1);
UPDATE "StaffInvitation" SET "churchId" = COALESCE((SELECT "churchId" FROM "User" WHERE "User"."id" = "StaffInvitation"."invitedById"), (SELECT "id" FROM "Church" ORDER BY "id" LIMIT 1));

ALTER TABLE "User" ADD CONSTRAINT "User_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SundayReview" ADD CONSTRAINT "SundayReview_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportingMonth" ADD CONSTRAINT "ReportingMonth_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportingWeek" ADD CONSTRAINT "ReportingWeek_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigOption" ADD CONSTRAINT "ConfigOption_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_serviceDate_key";
CREATE UNIQUE INDEX "AttendanceRecord_churchId_serviceDate_key" ON "AttendanceRecord"("churchId", "serviceDate");
ALTER TABLE "WeeklyReport" DROP CONSTRAINT IF EXISTS "WeeklyReport_reportDate_key";
CREATE UNIQUE INDEX "WeeklyReport_churchId_reportDate_key" ON "WeeklyReport"("churchId", "reportDate");
ALTER TABLE "WeeklyReport" DROP CONSTRAINT IF EXISTS "WeeklyReport_clientRequestId_key";
CREATE UNIQUE INDEX "WeeklyReport_churchId_clientRequestId_key" ON "WeeklyReport"("churchId", "clientRequestId");
ALTER TABLE "ReportingMonth" DROP CONSTRAINT IF EXISTS "ReportingMonth_year_month_key";
CREATE UNIQUE INDEX "ReportingMonth_churchId_year_month_key" ON "ReportingMonth"("churchId", "year", "month");
ALTER TABLE "ConfigOption" DROP CONSTRAINT IF EXISTS "ConfigOption_kind_name_key";
CREATE UNIQUE INDEX "ConfigOption_churchId_kind_name_key" ON "ConfigOption"("churchId", "kind", "name");

CREATE INDEX "User_churchId_idx" ON "User"("churchId");
CREATE INDEX "Activity_churchId_idx" ON "Activity"("churchId");
CREATE INDEX "Attendance_churchId_idx" ON "Attendance"("churchId");
CREATE INDEX "Expense_churchId_idx" ON "Expense"("churchId");
CREATE INDEX "SundayReview_churchId_idx" ON "SundayReview"("churchId");
CREATE INDEX "AttendanceRecord_churchId_idx" ON "AttendanceRecord"("churchId");
CREATE INDEX "AttendanceEntry_churchId_idx" ON "AttendanceEntry"("churchId");
CREATE INDEX "FinancialRecord_churchId_idx" ON "FinancialRecord"("churchId");
CREATE INDEX "WeeklyReport_churchId_idx" ON "WeeklyReport"("churchId");
CREATE INDEX "ReportingMonth_churchId_idx" ON "ReportingMonth"("churchId");
CREATE INDEX "ReportingWeek_churchId_idx" ON "ReportingWeek"("churchId");
CREATE INDEX "ConfigOption_churchId_idx" ON "ConfigOption"("churchId");
CREATE INDEX "StaffInvitation_churchId_idx" ON "StaffInvitation"("churchId");

CREATE TABLE "ChurchApplication" (
  "id" SERIAL NOT NULL,
  "churchName" TEXT NOT NULL,
  "denomination" TEXT,
  "address" TEXT,
  "applicantName" TEXT NOT NULL,
  "applicantEmail" TEXT NOT NULL,
  "phone" TEXT,
  "status" "ChurchApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "activationTokenHash" TEXT,
  "activationExpiresAt" TIMESTAMP(3),
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "churchId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChurchApplication_activationTokenHash_key" ON "ChurchApplication"("activationTokenHash");
CREATE INDEX "ChurchApplication_status_createdAt_idx" ON "ChurchApplication"("status", "createdAt");
CREATE INDEX "ChurchApplication_applicantEmail_idx" ON "ChurchApplication"("applicantEmail");
ALTER TABLE "ChurchApplication" ADD CONSTRAINT "ChurchApplication_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChurchApplication" ADD CONSTRAINT "ChurchApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SupportTicket" (
  "id" SERIAL NOT NULL,
  "churchId" INTEGER,
  "createdById" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_churchId_status_updatedAt_idx" ON "SupportTicket"("churchId", "status", "updatedAt");
CREATE INDEX "SupportTicket_createdById_createdAt_idx" ON "SupportTicket"("createdById", "createdAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupportTicketMessage" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

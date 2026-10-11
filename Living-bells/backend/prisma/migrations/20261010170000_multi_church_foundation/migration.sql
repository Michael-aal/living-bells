-- Expand-only multi-church foundation. Existing rows are preserved and assigned to The Bells.
DO $$ BEGIN
  CREATE TYPE "ChurchApplicationStatus" AS ENUM ('PENDING', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'ACTIVATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_CHURCH', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Church" (
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
CREATE INDEX IF NOT EXISTS "Church_name_idx" ON "Church"("name");

INSERT INTO "Church" ("name", "denomination", "createdAt", "updatedAt")
SELECT 'Foursquare Gospel Church, The Bells', 'Foursquare Gospel Church', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Church" WHERE "name" = 'Foursquare Gospel Church, The Bells'
);

-- These models exist in the Prisma schema but were never created by an earlier migration.
-- Create them before adding the tenant columns below; this also repairs databases where
-- the original multi-church migration stopped at the first missing table.
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
  "id" SERIAL NOT NULL,
  "serviceDate" TIMESTAMP(3) NOT NULL,
  "recordedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AttendanceEntry" (
  "id" SERIAL NOT NULL,
  "attendanceRecordId" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_serviceDate_key" ON "AttendanceRecord"("serviceDate");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_serviceDate_idx" ON "AttendanceRecord"("serviceDate");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_recordedById_idx" ON "AttendanceRecord"("recordedById");
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceEntry_attendanceRecordId_category_key" ON "AttendanceEntry"("attendanceRecordId", "category");
CREATE INDEX IF NOT EXISTS "AttendanceEntry_category_idx" ON "AttendanceEntry"("category");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_recordedById_fkey' AND conrelid = '"AttendanceRecord"'::regclass) THEN
    ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceEntry_attendanceRecordId_fkey' AND conrelid = '"AttendanceEntry"'::regclass) THEN
    ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "SundayReview" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "AttendanceEntry" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "FinancialRecord" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "WeeklyReport" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "ReportingMonth" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "ReportingWeek" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "ConfigOption" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;
ALTER TABLE "StaffInvitation" ADD COLUMN IF NOT EXISTS "churchId" INTEGER;

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
ALTER TABLE "Activity" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Attendance" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "SundayReview" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "AttendanceEntry" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "FinancialRecord" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "WeeklyReport" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "ReportingMonth" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "ReportingWeek" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "ConfigOption" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "StaffInvitation" ALTER COLUMN "churchId" SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_churchId_fkey' AND conrelid = '"User"'::regclass
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Activity_churchId_fkey' AND conrelid = '"Activity"'::regclass
  ) THEN
    ALTER TABLE "Activity" ADD CONSTRAINT "Activity_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Attendance_churchId_fkey' AND conrelid = '"Attendance"'::regclass
  ) THEN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Expense_churchId_fkey' AND conrelid = '"Expense"'::regclass
  ) THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SundayReview_churchId_fkey' AND conrelid = '"SundayReview"'::regclass
  ) THEN
    ALTER TABLE "SundayReview" ADD CONSTRAINT "SundayReview_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AttendanceRecord_churchId_fkey' AND conrelid = '"AttendanceRecord"'::regclass
  ) THEN
    ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AttendanceEntry_churchId_fkey' AND conrelid = '"AttendanceEntry"'::regclass
  ) THEN
    ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'FinancialRecord_churchId_fkey' AND conrelid = '"FinancialRecord"'::regclass
  ) THEN
    ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WeeklyReport_churchId_fkey' AND conrelid = '"WeeklyReport"'::regclass
  ) THEN
    ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ReportingMonth_churchId_fkey' AND conrelid = '"ReportingMonth"'::regclass
  ) THEN
    ALTER TABLE "ReportingMonth" ADD CONSTRAINT "ReportingMonth_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ReportingWeek_churchId_fkey' AND conrelid = '"ReportingWeek"'::regclass
  ) THEN
    ALTER TABLE "ReportingWeek" ADD CONSTRAINT "ReportingWeek_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ConfigOption_churchId_fkey' AND conrelid = '"ConfigOption"'::regclass
  ) THEN
    ALTER TABLE "ConfigOption" ADD CONSTRAINT "ConfigOption_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StaffInvitation_churchId_fkey' AND conrelid = '"StaffInvitation"'::regclass
  ) THEN
    ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_churchId_fkey' AND conrelid = '"User"'::regclass
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "AttendanceRecord_serviceDate_key";
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_churchId_serviceDate_key" ON "AttendanceRecord"("churchId", "serviceDate");
DROP INDEX IF EXISTS "WeeklyReport_reportDate_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReport_churchId_reportDate_key" ON "WeeklyReport"("churchId", "reportDate");
DROP INDEX IF EXISTS "WeeklyReport_clientRequestId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReport_churchId_clientRequestId_key" ON "WeeklyReport"("churchId", "clientRequestId");
DROP INDEX IF EXISTS "ReportingMonth_year_month_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ReportingMonth_churchId_year_month_key" ON "ReportingMonth"("churchId", "year", "month");
DROP INDEX IF EXISTS "ConfigOption_kind_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ConfigOption_churchId_kind_name_key" ON "ConfigOption"("churchId", "kind", "name");

CREATE INDEX IF NOT EXISTS "User_churchId_idx" ON "User"("churchId");
CREATE INDEX IF NOT EXISTS "Activity_churchId_idx" ON "Activity"("churchId");
CREATE INDEX IF NOT EXISTS "Attendance_churchId_idx" ON "Attendance"("churchId");
CREATE INDEX IF NOT EXISTS "Expense_churchId_idx" ON "Expense"("churchId");
CREATE INDEX IF NOT EXISTS "SundayReview_churchId_idx" ON "SundayReview"("churchId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_churchId_idx" ON "AttendanceRecord"("churchId");
CREATE INDEX IF NOT EXISTS "AttendanceEntry_churchId_idx" ON "AttendanceEntry"("churchId");
CREATE INDEX IF NOT EXISTS "FinancialRecord_churchId_idx" ON "FinancialRecord"("churchId");
CREATE INDEX IF NOT EXISTS "WeeklyReport_churchId_idx" ON "WeeklyReport"("churchId");
CREATE INDEX IF NOT EXISTS "ReportingMonth_churchId_idx" ON "ReportingMonth"("churchId");
CREATE INDEX IF NOT EXISTS "ReportingWeek_churchId_idx" ON "ReportingWeek"("churchId");
CREATE INDEX IF NOT EXISTS "ConfigOption_churchId_idx" ON "ConfigOption"("churchId");
CREATE INDEX IF NOT EXISTS "StaffInvitation_churchId_idx" ON "StaffInvitation"("churchId");

CREATE TABLE IF NOT EXISTS "ChurchApplication" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "ChurchApplication_activationTokenHash_key" ON "ChurchApplication"("activationTokenHash");
CREATE INDEX IF NOT EXISTS "ChurchApplication_status_createdAt_idx" ON "ChurchApplication"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ChurchApplication_applicantEmail_idx" ON "ChurchApplication"("applicantEmail");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ChurchApplication_churchId_fkey' AND conrelid = '"ChurchApplication"'::regclass
  ) THEN
    ALTER TABLE "ChurchApplication" ADD CONSTRAINT "ChurchApplication_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ChurchApplication_reviewedById_fkey' AND conrelid = '"ChurchApplication"'::regclass
  ) THEN
    ALTER TABLE "ChurchApplication" ADD CONSTRAINT "ChurchApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" SERIAL NOT NULL,
  "churchId" INTEGER NOT NULL,
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
CREATE INDEX IF NOT EXISTS "SupportTicket_churchId_status_updatedAt_idx" ON "SupportTicket"("churchId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_createdById_createdAt_idx" ON "SupportTicket"("createdById", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SupportTicket_churchId_fkey' AND conrelid = '"SupportTicket"'::regclass
  ) THEN
    ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SupportTicket_createdById_fkey' AND conrelid = '"SupportTicket"'::regclass
  ) THEN
    ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SupportTicketMessage" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SupportTicketMessage_ticketId_fkey' AND conrelid = '"SupportTicketMessage"'::regclass
  ) THEN
    ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SupportTicketMessage_authorId_fkey' AND conrelid = '"SupportTicketMessage"'::regclass
  ) THEN
    ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

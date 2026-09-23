-- Normalize weekly report keys to one UTC calendar date before enforcing uniqueness.
UPDATE "WeeklyReport"
SET "reportDate" = date_trunc('day', "reportDate");

-- If a pre-existing database contains duplicate report dates, keep the newest row.
DELETE FROM "WeeklyReport" a
USING "WeeklyReport" b
WHERE a."reportDate" = b."reportDate"
  AND a."id" < b."id";

CREATE UNIQUE INDEX "WeeklyReport_reportDate_key" ON "WeeklyReport"("reportDate");

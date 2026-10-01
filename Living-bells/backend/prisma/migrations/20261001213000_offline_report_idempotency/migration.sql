-- Add an idempotency key for offline weekly-report submissions.
ALTER TABLE "WeeklyReport" ADD COLUMN "clientRequestId" TEXT;
CREATE UNIQUE INDEX "WeeklyReport_clientRequestId_key" ON "WeeklyReport"("clientRequestId");

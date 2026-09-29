ALTER TABLE "WeeklyReport"
  ADD COLUMN "submittedById" INTEGER,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  ADD COLUMN "reviewedById" INTEGER,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewRating" "ReviewRating",
  ADD COLUMN "reviewComment" TEXT;

ALTER TABLE "WeeklyReport"
  ADD CONSTRAINT "WeeklyReport_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklyReport"
  ADD CONSTRAINT "WeeklyReport_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WeeklyReport_status_idx" ON "WeeklyReport"("status");
CREATE INDEX "WeeklyReport_submittedById_idx" ON "WeeklyReport"("submittedById");
CREATE INDEX "WeeklyReport_reviewedById_idx" ON "WeeklyReport"("reviewedById");

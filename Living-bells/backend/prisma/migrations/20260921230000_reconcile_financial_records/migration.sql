-- Reconcile the financial records schema with databases where the original
-- finance migration is recorded as applied but the table is missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'FinancialType'
  ) THEN
    CREATE TYPE "FinancialType" AS ENUM ('INCOME', 'EXPENSE');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "FinancialRecord" (
    "id" SERIAL NOT NULL,
    "type" "FinancialType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "recordedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinancialRecord_type_idx" ON "FinancialRecord"("type");
CREATE INDEX IF NOT EXISTS "FinancialRecord_category_idx" ON "FinancialRecord"("category");
CREATE INDEX IF NOT EXISTS "FinancialRecord_recordDate_idx" ON "FinancialRecord"("recordDate");
CREATE INDEX IF NOT EXISTS "FinancialRecord_recordedById_idx" ON "FinancialRecord"("recordedById");
CREATE INDEX IF NOT EXISTS "FinancialRecord_recordDate_type_idx" ON "FinancialRecord"("recordDate", "type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FinancialRecord_recordedById_fkey'
  ) THEN
    ALTER TABLE "FinancialRecord"
      ADD CONSTRAINT "FinancialRecord_recordedById_fkey"
      FOREIGN KEY ("recordedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

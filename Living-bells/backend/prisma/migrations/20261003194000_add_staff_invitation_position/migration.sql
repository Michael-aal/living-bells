DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'StaffInvitation'
      AND column_name = 'position'
  ) THEN
    ALTER TABLE "StaffInvitation"
      ADD COLUMN "position" TEXT NOT NULL DEFAULT 'Staff';
  ELSE
    UPDATE "StaffInvitation"
    SET "position" = 'Staff'
    WHERE "position" IS NULL;

    ALTER TABLE "StaffInvitation"
      ALTER COLUMN "position" SET DEFAULT 'Staff',
      ALTER COLUMN "position" SET NOT NULL;
  END IF;
END $$;

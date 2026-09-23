-- Add role-specific church profile details.
ALTER TABLE "User" ADD COLUMN "department" TEXT;
ALTER TABLE "User" ADD COLUMN "position" TEXT;

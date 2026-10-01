ALTER TABLE "User" ADD COLUMN "department" TEXT;

CREATE TABLE "StaffInvitation" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "invitedById" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffInvitation_codeHash_key" ON "StaffInvitation"("codeHash");
CREATE INDEX "StaffInvitation_email_idx" ON "StaffInvitation"("email");
CREATE INDEX "StaffInvitation_expiresAt_idx" ON "StaffInvitation"("expiresAt");
CREATE INDEX "StaffInvitation_usedAt_idx" ON "StaffInvitation"("usedAt");

ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

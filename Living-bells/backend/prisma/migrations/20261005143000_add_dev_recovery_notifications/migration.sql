ALTER TABLE "User"
  ADD COLUMN "devRecoveryKeyEncrypted" TEXT,
  ADD COLUMN "devRecoveryKeyNonce" TEXT,
  ADD COLUMN "devRecoveryKeyCreatedAt" TIMESTAMP(3);

CREATE TABLE "Notification" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

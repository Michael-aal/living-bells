-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReviewRating" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'BAD');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "emailVerifiedAt" TIMESTAMP(3),
    "emailVerifyTokenHash" TEXT,
    "emailVerifyExpiresAt" TIMESTAMP(3),
    "resetTokenHash" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "recordedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "recordedById" INTEGER,
    "childrenMale" INTEGER NOT NULL DEFAULT 0,
    "childrenFemale" INTEGER NOT NULL DEFAULT 0,
    "teenagersMale" INTEGER NOT NULL DEFAULT 0,
    "teenagersFemale" INTEGER NOT NULL DEFAULT 0,
    "youthMale" INTEGER NOT NULL DEFAULT 0,
    "youthFemale" INTEGER NOT NULL DEFAULT 0,
    "adultsMale" INTEGER NOT NULL DEFAULT 0,
    "adultsFemale" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER,
    "recordedById" INTEGER,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundayReview" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "rating" "ReviewRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundayReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerifyTokenHash_key" ON "User"("emailVerifyTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");

-- CreateIndex
CREATE INDEX "Activity_date_idx" ON "Activity"("date");

-- CreateIndex
CREATE INDEX "Activity_recordedById_idx" ON "Activity"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_activityId_key" ON "Attendance"("activityId");

-- CreateIndex
CREATE INDEX "Attendance_recordedById_idx" ON "Attendance"("recordedById");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_activityId_idx" ON "Expense"("activityId");

-- CreateIndex
CREATE INDEX "Expense_recordedById_idx" ON "Expense"("recordedById");

-- CreateIndex
CREATE INDEX "SundayReview_reviewDate_idx" ON "SundayReview"("reviewDate");

-- CreateIndex
CREATE INDEX "SundayReview_staffId_idx" ON "SundayReview"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "SundayReview_staffId_reviewDate_key" ON "SundayReview"("staffId", "reviewDate");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundayReview" ADD CONSTRAINT "SundayReview_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundayReview" ADD CONSTRAINT "SundayReview_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

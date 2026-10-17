-- CreateEnum
CREATE TYPE "PointsBasis" AS ENUM ('ATTENDANCE', 'DONATION');

-- CreateEnum
CREATE TYPE "PointReason" AS ENUM ('FIRST', 'RECURRING', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "AchievementCriteria" AS ENUM ('DONATION_COUNT', 'CAMPAIGN_DONATION');

-- CreateEnum
CREATE TYPE "HoursStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "engagement_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pointsBasis" "PointsBasis" NOT NULL DEFAULT 'ATTENDANCE',
    "firstPoints" INTEGER NOT NULL DEFAULT 100,
    "recurringPoints" INTEGER NOT NULL DEFAULT 150,
    "campaignPoints" INTEGER NOT NULL DEFAULT 50,
    "rankingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "engagement_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" "AchievementCriteria" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "donor_achievements" (
    "id" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "achievementCode" TEXT NOT NULL,
    "sourceEventId" UUID,
    "unlockedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "donor_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_entries" (
    "id" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" "PointReason" NOT NULL,
    "description" TEXT NOT NULL,
    "sourceEventId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donor_engagement" (
    "donorId" UUID NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "attendanceCount" INTEGER NOT NULL DEFAULT 0,
    "donationCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttendanceAt" TIMESTAMPTZ(3),
    "rankingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "nickname" TEXT,
    "institutionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "donor_engagement_pkey" PRIMARY KEY ("donorId")
);

-- CreateTable
CREATE TABLE "partner_institutions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "hoursPerDonation" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complementary_hours" (
    "id" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "donationId" UUID NOT NULL,
    "hours" INTEGER NOT NULL,
    "status" "HoursStatus" NOT NULL DEFAULT 'PENDING',
    "donatedAt" TIMESTAMPTZ(3) NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complementary_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "eventId" UUID NOT NULL,
    "consumer" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("eventId","consumer")
);

-- CreateIndex
CREATE UNIQUE INDEX "donor_achievements_donorId_achievementCode_key" ON "donor_achievements"("donorId", "achievementCode");

-- CreateIndex
CREATE INDEX "points_entries_donorId_createdAt_idx" ON "points_entries"("donorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "points_entries_sourceEventId_reason_key" ON "points_entries"("sourceEventId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "donor_engagement_nickname_key" ON "donor_engagement"("nickname");

-- CreateIndex
CREATE INDEX "donor_engagement_rankingOptIn_totalPoints_idx" ON "donor_engagement"("rankingOptIn", "totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "partner_institutions_name_key" ON "partner_institutions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "complementary_hours_donationId_key" ON "complementary_hours"("donationId");

-- CreateIndex
CREATE INDEX "complementary_hours_donorId_idx" ON "complementary_hours"("donorId");

-- CreateIndex
CREATE INDEX "complementary_hours_status_createdAt_idx" ON "complementary_hours"("status", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_publishedAt_occurredAt_idx" ON "outbox_events"("publishedAt", "occurredAt");

-- AddForeignKey
ALTER TABLE "donor_achievements" ADD CONSTRAINT "donor_achievements_achievementCode_fkey" FOREIGN KEY ("achievementCode") REFERENCES "achievements"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_engagement" ADD CONSTRAINT "donor_engagement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "partner_institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complementary_hours" ADD CONSTRAINT "complementary_hours_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "partner_institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restrições que o Prisma não expressa.
-- ---------------------------------------------------------------------------
ALTER TABLE "engagement_settings" ADD CONSTRAINT "engagement_settings_single_row" CHECK ("id" = 1);
ALTER TABLE "engagement_settings" ADD CONSTRAINT "engagement_settings_points"
  CHECK ("firstPoints" BETWEEN 0 AND 1000 AND "recurringPoints" BETWEEN 0 AND 1000 AND "campaignPoints" BETWEEN 0 AND 1000);
ALTER TABLE "complementary_hours" ADD CONSTRAINT "complementary_hours_positive" CHECK ("hours" > 0);
ALTER TABLE "partner_institutions" ADD CONSTRAINT "partner_institutions_hours" CHECK ("hoursPerDonation" BETWEEN 1 AND 40);

-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING_VALIDATION', 'VALIDATED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('BOOLEAN', 'SINGLE_CHOICE', 'NUMBER', 'DATE');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'LT', 'LTE', 'GT', 'GTE', 'WITHIN_DAYS');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('INFO', 'TALK_TO_UNIT', 'WAIT_UNTIL');

-- CreateEnum
CREATE TYPE "PreScreeningResult" AS ENUM ('FAVORABLE', 'TALK_TO_UNIT', 'WAIT_UNTIL');

-- CreateEnum
CREATE TYPE "ScreeningFieldType" AS ENUM ('NUMBER', 'TEXT', 'BOOLEAN', 'SELECT');

-- CreateEnum
CREATE TYPE "ScreeningResult" AS ENUM ('FIT', 'UNFIT', 'NEEDS_EVALUATION');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('COMPLETED', 'NOT_COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DONATION_DECLARATION', 'ATTENDANCE_DECLARATION');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateTable
CREATE TABLE "screening_rule_sets" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "status" "RuleSetStatus" NOT NULL DEFAULT 'DRAFT',
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "normativeReference" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_questions" (
    "id" UUID NOT NULL,
    "ruleSetId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "helpText" TEXT,
    "type" "QuestionType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "showIfCode" TEXT,
    "showIfValue" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "screening_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_rules" (
    "id" UUID NOT NULL,
    "ruleSetId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "operator" "RuleOperator" NOT NULL,
    "value" JSONB NOT NULL,
    "settingKey" TEXT,
    "severity" "RuleSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "screening_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_screenings" (
    "id" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "ruleSetId" UUID NOT NULL,
    "result" "PreScreeningResult" NOT NULL,
    "triggeredRuleIds" UUID[],
    "guidanceEncrypted" TEXT NOT NULL,
    "answersEncrypted" TEXT,
    "sharedWithStaff" BOOLEAN NOT NULL DEFAULT false,
    "waitUntil" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pre_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_screening_fields" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ScreeningFieldType" NOT NULL,
    "unit" TEXT,
    "options" JSONB,
    "helpText" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "professional_screening_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_screenings" (
    "id" UUID NOT NULL,
    "appointmentId" UUID,
    "donorId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "unitName" TEXT NOT NULL,
    "campaignId" UUID,
    "campaignTitle" TEXT,
    "professionalId" UUID NOT NULL,
    "professionalName" TEXT NOT NULL,
    "result" "ScreeningResult" NOT NULL,
    "valuesEncrypted" TEXT NOT NULL,
    "notesEncrypted" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "attendanceId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "unitName" TEXT NOT NULL,
    "campaignId" UUID,
    "professionalId" UUID NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "volumeMl" INTEGER NOT NULL,
    "status" "DonationStatus" NOT NULL,
    "notesEncrypted" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "nextEligibleAt" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "verificationCodeHash" TEXT NOT NULL,
    "verificationCodeEncrypted" TEXT NOT NULL,
    "holderInitials" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "pdf" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "validationStatus" "ValidationStatus",
    "updatedById" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_settings_pkey" PRIMARY KEY ("key")
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

-- CreateIndex
CREATE UNIQUE INDEX "screening_rule_sets_version_key" ON "screening_rule_sets"("version");

-- CreateIndex
CREATE UNIQUE INDEX "screening_questions_ruleSetId_code_key" ON "screening_questions"("ruleSetId", "code");

-- CreateIndex
CREATE INDEX "pre_screenings_donorId_createdAt_idx" ON "pre_screenings"("donorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "professional_screening_fields_code_key" ON "professional_screening_fields"("code");

-- CreateIndex
CREATE UNIQUE INDEX "professional_screenings_appointmentId_key" ON "professional_screenings"("appointmentId");

-- CreateIndex
CREATE INDEX "professional_screenings_donorId_createdAt_idx" ON "professional_screenings"("donorId", "createdAt");

-- CreateIndex
CREATE INDEX "professional_screenings_unitId_createdAt_idx" ON "professional_screenings"("unitId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "donations_code_key" ON "donations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "donations_attendanceId_key" ON "donations"("attendanceId");

-- CreateIndex
CREATE INDEX "donations_donorId_occurredAt_idx" ON "donations"("donorId", "occurredAt");

-- CreateIndex
CREATE INDEX "donations_occurredAt_idx" ON "donations"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "documents_verificationCodeHash_key" ON "documents"("verificationCodeHash");

-- CreateIndex
CREATE INDEX "documents_donorId_issuedAt_idx" ON "documents"("donorId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "documents_attendanceId_type_key" ON "documents"("attendanceId", "type");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_publishedAt_occurredAt_idx" ON "outbox_events"("publishedAt", "occurredAt");

-- AddForeignKey
ALTER TABLE "screening_questions" ADD CONSTRAINT "screening_questions_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "screening_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_rules" ADD CONSTRAINT "screening_rules_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "screening_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_rules" ADD CONSTRAINT "screening_rules_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "screening_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_screenings" ADD CONSTRAINT "pre_screenings_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "screening_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "professional_screenings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "professional_screenings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restrições que o Prisma não expressa.
-- ---------------------------------------------------------------------------
ALTER TABLE "screening_questions" ADD CONSTRAINT "screening_questions_step" CHECK ("step" BETWEEN 1 AND 6);
ALTER TABLE "donations" ADD CONSTRAINT "donations_volume" CHECK ("volumeMl" BETWEEN 0 AND 1000);
-- Só um conjunto de regras vigente por vez.
CREATE UNIQUE INDEX "screening_rule_sets_one_active" ON "screening_rule_sets" ("status") WHERE "status" = 'ACTIVE';

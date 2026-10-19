-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MovementReason" AS ENUM ('PROCESSED_COLLECTION', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'HOSPITAL_DISTRIBUTION', 'TRANSFER_OUT', 'EXPIRED_DISCARD', 'ADJUSTMENT_OUT');

-- CreateTable
CREATE TABLE "blood_stock" (
    "bloodType" "BloodType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "minimum" INTEGER NOT NULL,
    "ideal" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "blood_stock_pkey" PRIMARY KEY ("bloodType")
);

-- CreateTable
CREATE TABLE "blood_stock_movements" (
    "id" UUID NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "MovementReason" NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "responsibleId" UUID NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_stock_movements_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "blood_stock_movements_bloodType_occurredAt_idx" ON "blood_stock_movements"("bloodType", "occurredAt");

-- CreateIndex
CREATE INDEX "blood_stock_movements_occurredAt_idx" ON "blood_stock_movements"("occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_publishedAt_occurredAt_idx" ON "outbox_events"("publishedAt", "occurredAt");

-- AddForeignKey
ALTER TABLE "blood_stock_movements" ADD CONSTRAINT "blood_stock_movements_bloodType_fkey" FOREIGN KEY ("bloodType") REFERENCES "blood_stock"("bloodType") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restrições que o Prisma não expressa.
-- ---------------------------------------------------------------------------
ALTER TABLE "blood_stock" ADD CONSTRAINT "blood_stock_valid"
  CHECK ("quantity" >= 0 AND "minimum" >= 0 AND "ideal" >= "minimum");

ALTER TABLE "blood_stock_movements" ADD CONSTRAINT "blood_stock_movements_valid"
  CHECK ("quantity" > 0 AND "balanceAfter" >= 0);

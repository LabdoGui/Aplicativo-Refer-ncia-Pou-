-- AlterTable
ALTER TABLE "donor_engagement" ADD COLUMN     "campaignDonationCount" INTEGER NOT NULL DEFAULT 0;

-- Contadores nunca negativos.
ALTER TABLE "donor_engagement" ADD CONSTRAINT "donor_engagement_counters"
  CHECK ("totalPoints" >= 0 AND "attendanceCount" >= 0 AND "donationCount" >= 0
         AND "campaignDonationCount" >= 0 AND "campaignDonationCount" <= "donationCount");

-- RN20: apelido do ranking único sem diferenciar maiúsculas e minúsculas.
CREATE UNIQUE INDEX "donor_engagement_nickname_ci" ON "donor_engagement" (lower("nickname"));

import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma';
import { SettingsService } from '../catalog/settings.service';
import {
  applyAttendanceRules,
  applyDonationRules,
  type AchievementRule,
  type DonorCounters,
  type PointsAward,
} from '../rules/engagement-rules';

type Tx = Prisma.TransactionClient;

interface LockedDonor extends DonorCounters {
  institutionId: string | null;
  lastAttendanceAt: Date | null;
}

export interface ProgressResult {
  awards: PointsAward[];
  pointsAwarded: number;
  totalPoints: number;
  unlocked: AchievementRule[];
  hoursCreated: boolean;
}

export interface AttendanceInput {
  donorId: string;
  campaignId: string | null;
  occurredAt: Date;
  /** Id do evento de origem (idempotência dos lançamentos de pontos). */
  sourceEventId: string;
}

export interface DonationInput extends AttendanceInput {
  donationId: string;
}

/**
 * Aplica as regras puras ao banco, dentro da transação do consumidor (ou do
 * seed). A linha do doador é travada (FOR UPDATE) para que eventos simultâneos
 * do mesmo doador não percam incrementos.
 */
@Injectable()
export class ProgressService {
  constructor(private readonly settings: SettingsService) {}

  async recordAttendance(tx: Tx, input: AttendanceInput): Promise<ProgressResult> {
    const donor = await this.lockDonor(tx, input.donorId);
    const settings = await this.settings.get(tx);
    const outcome = applyAttendanceRules(donor, settings, { campaignId: input.campaignId });
    await this.savePoints(tx, input, outcome.awards);
    await tx.donorEngagement.update({
      where: { donorId: input.donorId },
      data: {
        totalPoints: outcome.counters.totalPoints,
        attendanceCount: outcome.counters.attendanceCount,
        lastAttendanceAt:
          donor.lastAttendanceAt && donor.lastAttendanceAt > input.occurredAt
            ? donor.lastAttendanceAt
            : input.occurredAt,
      },
    });
    return this.result(outcome.awards, outcome.counters, [], false);
  }

  async recordDonation(tx: Tx, input: DonationInput): Promise<ProgressResult> {
    const donor = await this.lockDonor(tx, input.donorId);
    const settings = await this.settings.get(tx);
    const [achievements, unlockedRows] = await Promise.all([
      tx.achievement.findMany({ orderBy: { order: 'asc' } }),
      tx.donorAchievement.findMany({
        where: { donorId: input.donorId },
        select: { achievementCode: true },
      }),
    ]);
    const outcome = applyDonationRules(
      donor,
      settings,
      achievements,
      new Set(unlockedRows.map((row) => row.achievementCode)),
      { campaignId: input.campaignId },
    );

    await this.savePoints(tx, input, outcome.awards);
    await tx.donorEngagement.update({
      where: { donorId: input.donorId },
      data: {
        totalPoints: outcome.counters.totalPoints,
        donationCount: outcome.counters.donationCount,
        campaignDonationCount: outcome.counters.campaignDonationCount,
      },
    });
    if (outcome.unlocked.length > 0) {
      await tx.donorAchievement.createMany({
        data: outcome.unlocked.map((rule) => ({
          donorId: input.donorId,
          achievementCode: rule.code,
          sourceEventId: input.sourceEventId,
          unlockedAt: input.occurredAt,
        })),
        skipDuplicates: true,
      });
    }

    // RN15: o pedido de horas nasce pendente; só a instituição (via administrador) aprova.
    let hoursCreated = false;
    if (donor.institutionId) {
      const institution = await tx.partnerInstitution.findUnique({
        where: { id: donor.institutionId },
      });
      if (institution?.active) {
        const created = await tx.complementaryHours.createMany({
          data: [
            {
              donorId: input.donorId,
              institutionId: institution.id,
              donationId: input.donationId,
              hours: institution.hoursPerDonation,
              donatedAt: input.occurredAt,
            },
          ],
          skipDuplicates: true,
        });
        hoursCreated = created.count > 0;
      }
    }
    return this.result(outcome.awards, outcome.counters, outcome.unlocked, hoursCreated);
  }

  /** Cria a linha do doador se faltar e a trava até o fim da transação. */
  private async lockDonor(tx: Tx, donorId: string): Promise<LockedDonor> {
    await tx.$executeRaw`
      INSERT INTO "donor_engagement" ("donorId", "createdAt", "updatedAt")
      VALUES (${donorId}::uuid, now(), now())
      ON CONFLICT ("donorId") DO NOTHING`;
    const rows = await tx.$queryRaw<LockedDonor[]>`
      SELECT "totalPoints", "attendanceCount", "donationCount", "campaignDonationCount",
             "institutionId", "lastAttendanceAt"
        FROM "donor_engagement" WHERE "donorId" = ${donorId}::uuid FOR UPDATE`;
    return rows[0];
  }

  private async savePoints(tx: Tx, input: AttendanceInput, awards: PointsAward[]): Promise<void> {
    if (awards.length === 0) return;
    await tx.pointsEntry.createMany({
      data: awards.map((award) => ({
        donorId: input.donorId,
        points: award.points,
        reason: award.reason,
        description: award.description,
        sourceEventId: input.sourceEventId,
        createdAt: input.occurredAt,
      })),
      skipDuplicates: true,
    });
  }

  private result(
    awards: PointsAward[],
    counters: DonorCounters,
    unlocked: AchievementRule[],
    hoursCreated: boolean,
  ): ProgressResult {
    return {
      awards,
      pointsAwarded: awards.reduce((sum, award) => sum + award.points, 0),
      totalPoints: counters.totalPoints,
      unlocked,
      hoursCreated,
    };
  }
}

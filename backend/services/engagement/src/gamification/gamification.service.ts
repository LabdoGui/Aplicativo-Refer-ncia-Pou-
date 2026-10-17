import { Injectable } from '@nestjs/common';
import { AppException, AuditService } from '@pulso/common';
import {
  levelFor,
  nextLevelFor,
  type AchievementCode,
  type AuthUser,
  type GamificationProfile,
  type PointReason,
  type RankingEntry,
  type RankingResponse,
} from '@pulso/contracts';
import { Prisma, type DonorEngagement } from '../../generated/prisma';
import { SettingsService } from '../catalog/settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { achievementProgress, rankPositions } from '../rules/engagement-rules';
import type { RankingOptInDto } from './dto/ranking-opt-in.dto';

/** Quantos participantes o ranking mostra. */
export const RANKING_SIZE = 10;

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async profile(donorId: string): Promise<GamificationProfile> {
    const donor = await this.ensureDonor(donorId);
    const [settings, achievements, unlocked, recentPoints] = await Promise.all([
      this.settings.get(),
      this.prisma.achievement.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      this.prisma.donorAchievement.findMany({ where: { donorId } }),
      this.prisma.pointsEntry.findMany({
        where: { donorId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    const unlockedAt = new Map(unlocked.map((row) => [row.achievementCode, row.unlockedAt]));
    const level = levelFor(donor.totalPoints);
    const next = nextLevelFor(donor.totalPoints);

    return {
      totalPoints: donor.totalPoints,
      level: { code: level.code, name: level.name, minPoints: level.minPoints },
      nextLevel: next
        ? {
            code: next.code,
            name: next.name,
            minPoints: next.minPoints,
            pointsToGo: next.minPoints - donor.totalPoints,
          }
        : null,
      attendanceCount: donor.attendanceCount,
      donationCount: donor.donationCount,
      lastAttendanceAt: donor.lastAttendanceAt?.toISOString() ?? null,
      pointsBasis: settings.pointsBasis,
      achievements: achievements.map((achievement) => ({
        code: achievement.code as AchievementCode,
        name: achievement.name,
        description: achievement.description,
        unlocked: unlockedAt.has(achievement.code),
        unlockedAt: unlockedAt.get(achievement.code)?.toISOString() ?? null,
        progress: achievementProgress(achievement, donor),
      })),
      recentPoints: recentPoints.map((entry) => ({
        id: entry.id,
        points: entry.points,
        reason: entry.reason as PointReason,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
      })),
      ranking: {
        enabled: settings.rankingEnabled,
        optIn: donor.rankingOptIn,
        nickname: donor.nickname,
      },
    };
  }

  /**
   * Top 10 de quem optou por participar, por pontos (desempate: quem entrou no
   * Pulso antes). Posições no estilo competição (1, 2, 2, 4).
   */
  async ranking(donorId: string): Promise<RankingResponse> {
    const settings = await this.settings.get();
    if (!settings.rankingEnabled) return { enabled: false, entries: [], me: null };

    const top = await this.prisma.donorEngagement.findMany({
      where: { rankingOptIn: true, nickname: { not: null } },
      orderBy: [{ totalPoints: 'desc' }, { createdAt: 'asc' }],
      take: RANKING_SIZE,
    });
    const entries: RankingEntry[] = rankPositions(
      top.map((row) => ({
        donorId: row.donorId,
        nickname: row.nickname!,
        totalPoints: row.totalPoints,
      })),
    ).map((row) => this.toEntry(row, row.position, donorId));

    let me = entries.find((entry) => entry.isMe) ?? null;
    if (!me) {
      const own = await this.prisma.donorEngagement.findUnique({ where: { donorId } });
      if (own?.rankingOptIn && own.nickname) {
        const ahead = await this.prisma.donorEngagement.count({
          where: {
            rankingOptIn: true,
            nickname: { not: null },
            totalPoints: { gt: own.totalPoints },
          },
        });
        me = this.toEntry(
          { nickname: own.nickname, totalPoints: own.totalPoints, donorId },
          ahead + 1,
          donorId,
        );
      }
    }
    return { enabled: true, entries, me };
  }

  async setRankingOptIn(
    actor: AuthUser,
    dto: RankingOptInDto,
    requestId?: string,
  ): Promise<GamificationProfile> {
    await this.ensureDonor(actor.id);
    const nickname = dto.optIn ? dto.nickname!.trim() : null;
    if (nickname) {
      const taken = await this.prisma.donorEngagement.findFirst({
        where: { nickname: { equals: nickname, mode: 'insensitive' }, donorId: { not: actor.id } },
        select: { donorId: true },
      });
      if (taken) throw this.nicknameTaken();
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.donorEngagement.update({
          where: { donorId: actor.id },
          data: { rankingOptIn: dto.optIn, nickname },
        });
        // O apelido não vai para a auditoria: só a escolha.
        await this.audit.record(
          {
            actor,
            action: 'ranking.opt_in_changed',
            entity: 'donor_engagement',
            entityId: actor.id,
            metadata: { optIn: dto.optIn },
            requestId,
          },
          tx,
        );
      });
    } catch (error) {
      // Corrida entre dois doadores escolhendo o mesmo apelido (índice único).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.nicknameTaken();
      }
      throw error;
    }
    return this.profile(actor.id);
  }

  /** Cria a linha do doador na primeira visita (sem pontos). */
  async ensureDonor(donorId: string): Promise<DonorEngagement> {
    await this.prisma.donorEngagement.createMany({ data: [{ donorId }], skipDuplicates: true });
    return this.prisma.donorEngagement.findUniqueOrThrow({ where: { donorId } });
  }

  private toEntry(
    row: { donorId: string; nickname: string; totalPoints: number },
    position: number,
    viewerId: string,
  ): RankingEntry {
    return {
      position,
      nickname: row.nickname,
      points: row.totalPoints,
      levelName: levelFor(row.totalPoints).name,
      isMe: row.donorId === viewerId,
    };
  }

  private nicknameTaken(): AppException {
    return new AppException(
      409,
      'NICKNAME_TAKEN',
      'Este apelido já está em uso. Escolha outro.',
      undefined,
      [{ field: 'nickname', message: 'Este apelido já está em uso.' }],
    );
  }
}

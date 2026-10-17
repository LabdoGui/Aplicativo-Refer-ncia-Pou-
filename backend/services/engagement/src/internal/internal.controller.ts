import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalOnly, StatsQueryDto, statsRange } from '@pulso/common';
import { LEVELS, levelFor, type EngagementStats } from '@pulso/contracts';
import { PrismaService } from '../prisma/prisma.service';

/** Rotas entre serviços (token interno); o gateway bloqueia /internal para fora. */
@ApiExcludeController()
@InternalOnly()
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Indicadores do período (pontos e conquistas por data do lançamento) e
   * totais atuais (horas em horas, participantes do ranking, níveis).
   * A gamificação não é recortada por unidade nem tipo sanguíneo.
   */
  @Get('stats')
  async stats(@Query() query: StatsQueryDto): Promise<EngagementStats> {
    const { start, end } = statsRange(query);
    const [points, achievementsUnlocked, hours, rankingParticipants, donors] = await Promise.all([
      this.prisma.pointsEntry.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { points: true },
      }),
      this.prisma.donorAchievement.count({ where: { unlockedAt: { gte: start, lte: end } } }),
      this.prisma.complementaryHours.groupBy({ by: ['status'], _sum: { hours: true } }),
      this.prisma.donorEngagement.count({ where: { rankingOptIn: true } }),
      this.prisma.donorEngagement.findMany({ select: { totalPoints: true } }),
    ]);
    const hoursBy = (status: string) => hours.find((row) => row.status === status)?._sum.hours ?? 0;
    const levelCounts = new Map<string, number>(LEVELS.map((level) => [level.code, 0]));
    for (const donor of donors) {
      const code = levelFor(donor.totalPoints).code;
      levelCounts.set(code, (levelCounts.get(code) ?? 0) + 1);
    }
    return {
      pointsAwarded: points._sum.points ?? 0,
      achievementsUnlocked,
      hoursPending: hoursBy('PENDING'),
      hoursApproved: hoursBy('APPROVED'),
      rankingParticipants,
      levels: LEVELS.map((level) => ({
        code: level.code,
        name: level.name,
        count: levelCounts.get(level.code) ?? 0,
      })),
    };
  }
}

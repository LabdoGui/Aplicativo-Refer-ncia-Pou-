import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, buildSeedDataset, SEED_IDS, seedUuid } from '@pulso/common';
import type { EngagementEnv } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';

/** Pedidos com doação há mais que isso já foram revisados no histórico fictício. */
const REVIEWED_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Dados fictícios de demonstração (SEED_DEMO_DATA=true, banco sem doadores nem
 * instituições). O histórico de atendimentos do dataset é reproduzido pelas
 * mesmas regras dos consumidores, então pontos e conquistas batem com o clinical.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
    @Inject(APP_CONFIG) private readonly config: EngagementEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DEMO_DATA) return;
    const [institutions, donors] = await Promise.all([
      this.prisma.partnerInstitution.count(),
      this.prisma.donorEngagement.count(),
    ]);
    if (institutions > 0 || donors > 0) return;

    const dataset = buildSeedDataset();
    await this.prisma.$transaction(
      async (tx) => {
        await tx.partnerInstitution.createMany({ data: dataset.institutions });

        // Vínculos com instituições antes do histórico, para os pedidos de horas nascerem.
        const linked = Object.entries(dataset.donorInstitutions);
        await tx.donorEngagement.createMany({
          data: linked.map(([donorId, institutionId]) => ({ donorId, institutionId })),
        });

        for (const attendance of dataset.attendances) {
          await this.progress.recordAttendance(tx, {
            donorId: attendance.donorId,
            campaignId: attendance.campaignId,
            occurredAt: new Date(attendance.attendedAt),
            sourceEventId: seedUuid(`event:attendance:${attendance.id}`),
          });
          if (attendance.donation?.status === 'COMPLETED') {
            await this.progress.recordDonation(tx, {
              donorId: attendance.donorId,
              donationId: attendance.donation.id,
              campaignId: attendance.campaignId,
              occurredAt: new Date(attendance.donation.occurredAt),
              sourceEventId: seedUuid(`event:donation:${attendance.donation.id}`),
            });
          }
        }

        // Pedidos antigos já revisados; um recusado (de outro doador) para ilustrar.
        const cutoff = new Date(Date.now() - REVIEWED_AFTER_DAYS * DAY_MS);
        const hours = await tx.complementaryHours.findMany({ orderBy: { donatedAt: 'asc' } });
        const rejected = hours.find(
          (row) => row.donatedAt < cutoff && row.donorId !== SEED_IDS.users.donor,
        );
        for (const row of hours.filter((item) => item.donatedAt < cutoff)) {
          const isRejected = row.id === rejected?.id;
          await tx.complementaryHours.update({
            where: { id: row.id },
            data: {
              status: isRejected ? 'REJECTED' : 'APPROVED',
              reviewedById: SEED_IDS.users.admin,
              reviewedAt: new Date(row.donatedAt.getTime() + 5 * DAY_MS),
              reviewNote: isRejected
                ? 'A instituição não reconheceu esta atividade para o semestre (exemplo fictício).'
                : null,
            },
          });
        }

        for (const { donorId, nickname } of dataset.rankingOptIns) {
          await tx.donorEngagement.upsert({
            where: { donorId },
            create: { donorId, rankingOptIn: true, nickname },
            update: { rankingOptIn: true, nickname },
          });
        }
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    this.logger.log(
      { attendances: dataset.attendances.length, institutions: dataset.institutions.length },
      'Dados fictícios de demonstração gravados',
    );
  }
}

import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, buildSeedDataset, SEED_IDS } from '@pulso/common';
import { stockStatusFor } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';
import type { NotificationEnv } from '../config';
import * as messages from '../notifications/notification-messages';
import type { NotificationDraft } from '../notifications/notification-messages';
import { PrismaService } from '../prisma/prisma.service';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Notificações fictícias de demonstração (SEED_DEMO_DATA=true, tabela vazia),
 * com os mesmos textos gerados pelos eventos reais.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: NotificationEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DEMO_DATA) return;
    if ((await this.prisma.notification.count()) > 0) return;
    const rows = buildSeedRows();
    await this.prisma.notification.createMany({ data: rows });
    this.logger.log(
      { notifications: rows.length },
      'Notificações fictícias de demonstração gravadas',
    );
  }
}

/** Linhas do seed (exportada para teste). */
export function buildSeedRows(now: Date = new Date()): Prisma.NotificationCreateManyInput[] {
  const dataset = buildSeedDataset();
  const rows: Prisma.NotificationCreateManyInput[] = [];
  const add = (item: NotificationDraft | null, createdAt: Date, read: boolean) => {
    if (!item) return;
    rows.push({ ...item, createdAt, readAt: read ? new Date(createdAt.getTime() + HOUR) : null });
  };

  const donor = dataset.users.find((user) => user.id === SEED_IDS.users.donor);
  if (donor) {
    add(
      messages.welcome({ userId: donor.id, name: donor.name, role: 'DONOR' }),
      new Date(donor.createdAt),
      true,
    );
  }
  const attendance = dataset.attendances.find(
    (item) => item.donorId === SEED_IDS.users.donor && item.donation?.status === 'COMPLETED',
  );
  if (attendance?.donation) {
    const donatedAt = new Date(attendance.donation.occurredAt);
    add(
      messages.donationCompleted({
        donationId: attendance.donation.id,
        code: attendance.donation.code,
        donorId: attendance.donorId,
        unitId: attendance.unitId,
        attendanceId: attendance.id,
        campaignId: attendance.campaignId,
        occurredAt: attendance.donation.occurredAt,
      }),
      donatedAt,
      true,
    );
    add(
      messages.achievementUnlocked({
        donorId: attendance.donorId,
        achievementCode: 'FIRST_DONATION',
        achievementName: 'Primeira Doação',
      }),
      new Date(donatedAt.getTime() + 60_000),
      true,
    );
    add(
      messages.pointsAwarded({
        donorId: attendance.donorId,
        points: 100,
        reason: 'FIRST',
        totalPoints: 100,
      }),
      new Date(donatedAt.getTime() + 2 * 60_000),
      false,
    );
    const institutionId = dataset.donorInstitutions[attendance.donorId];
    const institution = dataset.institutions.find((item) => item.id === institutionId);
    if (institution) {
      add(
        messages.hoursReviewed({
          hoursId: attendance.donation.id,
          donorId: attendance.donorId,
          hours: institution.hoursPerDonation,
          status: 'APPROVED',
          institutionName: institution.name,
        }),
        new Date(donatedAt.getTime() + 5 * DAY),
        false,
      );
    }
  }

  dataset.stock
    .filter((item) => stockStatusFor(item.quantity, item.minimum, item.ideal) === 'CRITICAL')
    .forEach((item, index) => {
      const [alert] = messages.stockAlert(
        {
          bloodType: item.bloodType,
          previousStatus: 'ATTENTION',
          status: 'CRITICAL',
          quantity: item.quantity,
        },
        [SEED_IDS.users.admin],
      );
      add(alert, new Date(now.getTime() - (index + 1) * HOUR), false);
    });

  return rows;
}

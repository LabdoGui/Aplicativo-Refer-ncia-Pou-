import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { PointsBasis } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { RuleSettings } from '../rules/engagement-rules';
import { ACHIEVEMENT_CATALOG, DEFAULT_SETTINGS } from './catalog';

export type EngagementSettingsValues = RuleSettings & { rankingEnabled: boolean };

type Client = PrismaService | Prisma.TransactionClient;

/**
 * Parâmetros da gamificação e catálogo de conquistas. O catálogo é dado de
 * referência (não de demonstração): é garantido em todo boot, com ou sem seed.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const settings = await this.prisma.engagementSettings.createMany({
      data: [{ id: 1, ...DEFAULT_SETTINGS }],
      skipDuplicates: true,
    });
    const achievements = await this.prisma.achievement.createMany({
      data: ACHIEVEMENT_CATALOG,
      skipDuplicates: true,
    });
    if (settings.count + achievements.count > 0) {
      this.logger.log(
        { settings: settings.count, achievements: achievements.count },
        'Catálogo da gamificação criado',
      );
    }
  }

  async get(client: Client = this.prisma): Promise<EngagementSettingsValues> {
    const row = await client.engagementSettings.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_SETTINGS;
    return {
      pointsBasis: row.pointsBasis as PointsBasis,
      firstPoints: row.firstPoints,
      recurringPoints: row.recurringPoints,
      campaignPoints: row.campaignPoints,
      rankingEnabled: row.rankingEnabled,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { AppException, AuditService } from '@pulso/common';
import {
  ACHIEVEMENT_CODES,
  type AchievementCode,
  type AdminAchievementView,
  type AuthUser,
  type GamificationSettingsView,
  type InstitutionView,
} from '@pulso/contracts';
import { Prisma, type Achievement, type PartnerInstitution } from '../../generated/prisma';
import { SettingsService } from '../catalog/settings.service';
import { toInstitutionView } from '../hours/hours.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateInstitutionDto,
  UpdateAchievementDto,
  UpdateGamificationSettingsDto,
  UpdateInstitutionDto,
} from './dto/admin.dto';

/** Conquistas, parâmetros da gamificação e instituições parceiras. */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async achievements(): Promise<AdminAchievementView[]> {
    const [rows, counts] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.donorAchievement.groupBy({ by: ['achievementCode'], _count: { _all: true } }),
    ]);
    const unlocked = new Map(counts.map((row) => [row.achievementCode, row._count._all]));
    return rows.map((row) => this.toAchievementView(row, unlocked.get(row.code) ?? 0));
  }

  async updateAchievement(
    actor: AuthUser,
    code: string,
    dto: UpdateAchievementDto,
    requestId?: string,
  ): Promise<AdminAchievementView> {
    if (!ACHIEVEMENT_CODES.includes(code as AchievementCode)) {
      throw new AppException(404, 'ACHIEVEMENT_NOT_FOUND', 'Conquista não encontrada.');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.achievement.update({ where: { code }, data: dto });
      await this.audit.record(
        {
          actor,
          action: 'achievement.updated',
          entity: 'achievement',
          entityId: code,
          metadata: { fields: Object.keys(dto), active: dto.active },
          requestId,
        },
        tx,
      );
      return updated;
    });
    const unlockedCount = await this.prisma.donorAchievement.count({
      where: { achievementCode: code },
    });
    return this.toAchievementView(row, unlockedCount);
  }

  getSettings(): Promise<GamificationSettingsView> {
    return this.settings.get();
  }

  async updateSettings(
    actor: AuthUser,
    dto: UpdateGamificationSettingsDto,
    requestId?: string,
  ): Promise<GamificationSettingsView> {
    await this.prisma.$transaction(async (tx) => {
      await tx.engagementSettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...(await this.settings.get(tx)), ...dto },
        update: dto,
      });
      await this.audit.record(
        {
          actor,
          action: 'gamification.settings_updated',
          entity: 'engagement_settings',
          entityId: '1',
          metadata: { ...dto },
          requestId,
        },
        tx,
      );
    });
    return this.settings.get();
  }

  async institutions(): Promise<InstitutionView[]> {
    const rows = await this.prisma.partnerInstitution.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toInstitutionView);
  }

  async createInstitution(
    actor: AuthUser,
    dto: CreateInstitutionDto,
    requestId?: string,
  ): Promise<InstitutionView> {
    return this.saveInstitution(actor, 'institution.created', requestId, (tx) =>
      tx.partnerInstitution.create({ data: dto }),
    );
  }

  async updateInstitution(
    actor: AuthUser,
    id: string,
    dto: UpdateInstitutionDto,
    requestId?: string,
  ): Promise<InstitutionView> {
    const exists = await this.prisma.partnerInstitution.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists)
      throw new AppException(404, 'INSTITUTION_NOT_FOUND', 'Instituição não encontrada.');
    return this.saveInstitution(actor, 'institution.updated', requestId, (tx) =>
      tx.partnerInstitution.update({ where: { id }, data: dto }),
    );
  }

  private async saveInstitution(
    actor: AuthUser,
    action: string,
    requestId: string | undefined,
    write: (tx: Prisma.TransactionClient) => Promise<PartnerInstitution>,
  ): Promise<InstitutionView> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const saved = await write(tx);
        await this.audit.record(
          {
            actor,
            action,
            entity: 'partner_institution',
            entityId: saved.id,
            metadata: { hoursPerDonation: saved.hoursPerDonation, active: saved.active },
            requestId,
          },
          tx,
        );
        return saved;
      });
      return toInstitutionView(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          409,
          'INSTITUTION_NAME_TAKEN',
          'Já existe uma instituição com este nome.',
          undefined,
          [{ field: 'name', message: 'Já existe uma instituição com este nome.' }],
        );
      }
      throw error;
    }
  }

  private toAchievementView(row: Achievement, unlockedCount: number): AdminAchievementView {
    return {
      code: row.code as AchievementCode,
      name: row.name,
      description: row.description,
      criteria: row.criteria,
      threshold: row.threshold,
      active: row.active,
      unlockedCount,
    };
  }
}

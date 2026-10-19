import { Injectable } from '@nestjs/common';
import { AppException, AuditService, todayLocal, toLocalDate } from '@pulso/common';
import type { AuthUser, CampaignView } from '@pulso/contracts';
import type { Campaign, HealthUnit, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CampaignInputDto, UpdateCampaignDto } from './dto/campaigns.dto';

type CampaignWithUnit = Campaign & { unit: Pick<HealthUnit, 'id' | 'name'> | null };

/** Datas de campanha são `date` (meia-noite UTC no banco). */
export const dateOnly = (value: string) => new Date(`${value}T00:00:00Z`);
const isoDate = (value: Date) => value.toISOString().slice(0, 10);

export function toCampaignView(campaign: CampaignWithUnit): CampaignView {
  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    bloodTypes: campaign.bloodTypes,
    unit: campaign.unit ? { id: campaign.unit.id, name: campaign.unit.name } : null,
    startsAt: isoDate(campaign.startsAt),
    endsAt: isoDate(campaign.endsAt),
    active: campaign.active,
  };
}

/** A campanha vale para o agendamento: ativa, na data e na unidade (ou em todas). */
export function campaignAppliesTo(
  campaign: Pick<Campaign, 'active' | 'unitId' | 'startsAt' | 'endsAt'>,
  unitId: string,
  localDate: string,
): boolean {
  return (
    campaign.active &&
    (campaign.unitId === null || campaign.unitId === unitId) &&
    isoDate(campaign.startsAt) <= localDate &&
    localDate <= isoDate(campaign.endsAt)
  );
}

const WITH_UNIT = { unit: { select: { id: true, name: true } } } as const;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(includeInactive: boolean): Promise<CampaignView[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: includeInactive ? {} : { active: true, endsAt: { gte: dateOnly(todayLocal()) } },
      include: WITH_UNIT,
      orderBy: [{ startsAt: 'desc' }, { title: 'asc' }],
    });
    return campaigns.map(toCampaignView);
  }

  /**
   * Valida a campanha escolhida no agendamento. Sem campanha → null.
   * `tolerant` (reagendamento): campanha que não vale mais vira null em vez de erro.
   */
  async resolveForBooking(
    campaignId: string | null | undefined,
    unitId: string,
    startsAt: Date,
    zone: string,
    tolerant = false,
  ): Promise<string | null> {
    if (!campaignId) return null;
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (campaign && campaignAppliesTo(campaign, unitId, toLocalDate(startsAt, zone))) {
      return campaign.id;
    }
    if (tolerant) return null;
    throw new AppException(
      422,
      'INVALID_CAMPAIGN',
      'Esta campanha não vale para a unidade ou a data escolhida. Agende sem campanha ou escolha outra data.',
    );
  }

  async create(actor: AuthUser, dto: CampaignInputDto, requestId?: string): Promise<CampaignView> {
    this.assertPeriod(dto.startsAt, dto.endsAt);
    await this.assertUnit(dto.unitId);
    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          title: dto.title,
          description: dto.description,
          bloodTypes: dto.bloodTypes,
          unitId: dto.unitId ?? null,
          startsAt: dateOnly(dto.startsAt),
          endsAt: dateOnly(dto.endsAt),
          active: dto.active ?? true,
        },
        include: WITH_UNIT,
      });
      await this.audit.record(
        { actor, action: 'campaign.created', entity: 'campaign', entityId: created.id, requestId },
        tx,
      );
      return created;
    });
    return toCampaignView(campaign);
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateCampaignDto,
    requestId?: string,
  ): Promise<CampaignView> {
    const current = await this.prisma.campaign.findUnique({ where: { id } });
    if (!current) throw new AppException(404, 'CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.');
    this.assertPeriod(
      dto.startsAt ?? isoDate(current.startsAt),
      dto.endsAt ?? isoDate(current.endsAt),
    );
    if (dto.unitId !== undefined) await this.assertUnit(dto.unitId);

    const data: Prisma.CampaignUncheckedUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.bloodTypes !== undefined ? { bloodTypes: dto.bloodTypes } : {}),
      ...(dto.unitId !== undefined ? { unitId: dto.unitId } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: dateOnly(dto.startsAt) } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: dateOnly(dto.endsAt) } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
    const campaign = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.campaign.update({ where: { id }, data, include: WITH_UNIT });
      await this.audit.record(
        {
          actor,
          action: 'campaign.updated',
          entity: 'campaign',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
          requestId,
        },
        tx,
      );
      return updated;
    });
    return toCampaignView(campaign);
  }

  private assertPeriod(startsAt: string, endsAt: string): void {
    if (startsAt > endsAt) {
      throw new AppException(
        400,
        'INVALID_PERIOD',
        'A data final precisa ser igual ou posterior à inicial.',
        undefined,
        [{ field: 'endsAt', message: 'A data final precisa ser igual ou posterior à inicial.' }],
      );
    }
  }

  private async assertUnit(unitId: string | null | undefined): Promise<void> {
    if (!unitId) return;
    const unit = await this.prisma.healthUnit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new AppException(422, 'UNIT_NOT_FOUND', 'Unidade não encontrada.', undefined, [
        { field: 'unitId', message: 'Unidade não encontrada.' },
      ]);
    }
  }
}

import { Injectable } from '@nestjs/common';
import { AuditService } from '@pulso/common';
import type { AuthUser, ClinicalSettingsView, ValidationStatus } from '@pulso/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateClinicalSettingsDto } from './dto/settings.dto';

/** Chaves das configurações clínicas (tabela clinical_settings). */
export const SETTING_KEYS = {
  donationIntervalDays: 'donationIntervalDays',
  preScreeningValidityDays: 'preScreeningValidityDays',
} as const;

/**
 * Valores de demonstração (D7). O intervalo entre doações é parâmetro da
 * instituição e fica sempre marcado como pendente de validação.
 */
export const DEFAULT_SETTINGS = {
  donationIntervalDays: 90,
  preScreeningValidityDays: 30,
} as const;

export interface ClinicalSettings {
  donationIntervalDays: number;
  preScreeningValidityDays: number;
  intervalValidationStatus: ValidationStatus;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<ClinicalSettings> {
    const rows = await this.prisma.clinicalSetting.findMany();
    const byKey = new Map(rows.map((row) => [row.key, row]));
    const interval = byKey.get(SETTING_KEYS.donationIntervalDays);
    return {
      donationIntervalDays: asNumber(interval?.value, DEFAULT_SETTINGS.donationIntervalDays),
      preScreeningValidityDays: asNumber(
        byKey.get(SETTING_KEYS.preScreeningValidityDays)?.value,
        DEFAULT_SETTINGS.preScreeningValidityDays,
      ),
      intervalValidationStatus: interval?.validationStatus ?? 'PENDING_VALIDATION',
    };
  }

  /** Valores numéricos por chave, para regras que usam `settingKey`. */
  async numericValues(): Promise<Record<string, number>> {
    const settings = await this.get();
    return {
      donationIntervalDays: settings.donationIntervalDays,
      preScreeningValidityDays: settings.preScreeningValidityDays,
    };
  }

  view(settings: ClinicalSettings): ClinicalSettingsView {
    return { ...settings };
  }

  async update(
    actor: AuthUser,
    dto: UpdateClinicalSettingsDto,
    requestId?: string,
  ): Promise<ClinicalSettingsView> {
    await this.prisma.$transaction(async (tx) => {
      if (dto.donationIntervalDays !== undefined) {
        // Mudar o valor não o valida: continua pendente de validação profissional.
        await tx.clinicalSetting.upsert({
          where: { key: SETTING_KEYS.donationIntervalDays },
          create: {
            key: SETTING_KEYS.donationIntervalDays,
            value: dto.donationIntervalDays,
            validationStatus: 'PENDING_VALIDATION',
            updatedById: actor.id,
          },
          update: {
            value: dto.donationIntervalDays,
            validationStatus: 'PENDING_VALIDATION',
            updatedById: actor.id,
          },
        });
      }
      if (dto.preScreeningValidityDays !== undefined) {
        await tx.clinicalSetting.upsert({
          where: { key: SETTING_KEYS.preScreeningValidityDays },
          create: {
            key: SETTING_KEYS.preScreeningValidityDays,
            value: dto.preScreeningValidityDays,
            updatedById: actor.id,
          },
          update: { value: dto.preScreeningValidityDays, updatedById: actor.id },
        });
      }
      await this.audit.record(
        {
          actor,
          action: 'settings.updated',
          entity: 'clinical_settings',
          metadata: { ...dto },
          requestId,
        },
        tx,
      );
    });
    return this.view(await this.get());
  }
}

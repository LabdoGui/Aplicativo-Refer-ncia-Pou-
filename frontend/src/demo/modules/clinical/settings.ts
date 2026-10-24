/**
 * Configurações clínicas (espelho de settings/settings.service.ts e do
 * controller /clinical-settings).
 */
import type { AuthUser, ClinicalSettingsView, ValidationStatus } from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { route, type AuthedRequest } from '../../core/http';
import { nowIso } from '../../core/support';
import { clinical, SERVICE, type ClinicalSettingRow } from './state';
import { asNumber, assertCanWrite, bodyOf, Checker } from './validation';

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

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getSettings(): ClinicalSettings {
  const byKey = new Map(clinical().settings.map((row) => [row.key, row]));
  const interval = byKey.get(SETTING_KEYS.donationIntervalDays);
  return {
    donationIntervalDays: numberOr(interval?.value, DEFAULT_SETTINGS.donationIntervalDays),
    preScreeningValidityDays: numberOr(
      byKey.get(SETTING_KEYS.preScreeningValidityDays)?.value,
      DEFAULT_SETTINGS.preScreeningValidityDays,
    ),
    intervalValidationStatus: interval?.validationStatus ?? 'PENDING_VALIDATION',
  };
}

/** Valores numéricos por chave, para regras que usam `settingKey`. */
export function numericSettings(): Record<string, number> {
  const settings = getSettings();
  return {
    donationIntervalDays: settings.donationIntervalDays,
    preScreeningValidityDays: settings.preScreeningValidityDays,
  };
}

const view = (settings: ClinicalSettings): ClinicalSettingsView => ({ ...settings });

function upsert(
  key: string,
  data: Pick<ClinicalSettingRow, 'value' | 'updatedById'> & {
    validationStatus?: ValidationStatus;
  },
): void {
  const rows = clinical().settings;
  const row = rows.find((candidate) => candidate.key === key);
  const updatedAt = nowIso();
  if (row) {
    row.value = data.value;
    row.updatedById = data.updatedById;
    if (data.validationStatus) row.validationStatus = data.validationStatus;
    row.updatedAt = updatedAt;
  } else {
    rows.push({
      key,
      value: data.value,
      validationStatus: data.validationStatus ?? null,
      updatedById: data.updatedById,
      updatedAt,
    });
  }
}

function update(actor: AuthUser, input: unknown): ClinicalSettingsView {
  const body = bodyOf(input);
  const check = new Checker(body, ['donationIntervalDays', 'preScreeningValidityDays']);
  const interval = asNumber(body.donationIntervalDays);
  const validity = asNumber(body.preScreeningValidityDays);
  if (interval !== undefined && interval !== null) {
    check.number('donationIntervalDays', interval, { int: true, min: 30, max: 365 });
  }
  if (validity !== undefined && validity !== null) {
    check.number('preScreeningValidityDays', validity, { int: true, min: 1, max: 90 });
  }
  check.done();
  const dto: { donationIntervalDays?: number; preScreeningValidityDays?: number } = {};
  if (typeof interval === 'number') dto.donationIntervalDays = interval;
  if (typeof validity === 'number') dto.preScreeningValidityDays = validity;

  if (dto.donationIntervalDays !== undefined) {
    // Mudar o valor não o valida: continua pendente de validação profissional.
    upsert(SETTING_KEYS.donationIntervalDays, {
      value: dto.donationIntervalDays,
      validationStatus: 'PENDING_VALIDATION',
      updatedById: actor.id,
    });
  }
  if (dto.preScreeningValidityDays !== undefined) {
    upsert(SETTING_KEYS.preScreeningValidityDays, {
      value: dto.preScreeningValidityDays,
      updatedById: actor.id,
    });
  }
  recordAudit(SERVICE, {
    actor,
    action: 'settings.updated',
    entity: 'clinical_settings',
    metadata: { ...dto },
  });
  return view(getSettings());
}

export function registerSettings(): void {
  const options = { permissions: ['settings:manage' as const] };
  route('GET', '/clinical-settings', () => view(getSettings()), options);
  route(
    'PATCH',
    '/clinical-settings',
    (request: AuthedRequest) => {
      assertCanWrite(request.user);
      return update(request.user, request.body);
    },
    options,
  );
}

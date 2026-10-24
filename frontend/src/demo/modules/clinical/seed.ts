/**
 * Seed do clinical-service (espelho de seed/seed.service.ts): questionário base,
 * regras, campos da triagem, configurações e o histórico fictício de
 * atendimentos e doações do dataset compartilhado (SEED_DEMO_DATA=true).
 */
import { createHash } from 'node:crypto';
import type { AnswerValue } from '@pulso/contracts';
import { seedUuid } from '@backend/libs/common/src/seed/dataset';
import {
  SEED_FIELDS,
  SEED_QUESTIONS,
  SEED_RULE_SET,
} from '@backend/services/clinical/src/seed/seed-content';
import type { SeedContext } from '../../core/state';
import { nowIso } from '../../core/support';
import { nextEligibleDate } from './eligibility';
import { DEFAULT_SETTINGS, SETTING_KEYS } from './settings';
import type {
  ClinicalAttendance,
  ClinicalDonation,
  ClinicalQuestion,
  ClinicalRule,
  ClinicalState,
} from './state';

/** Valor fictício estável por atendimento (mesmo resultado a cada seed). */
function pseudo(key: string, min: number, max: number, decimals = 0): number {
  const fraction =
    parseInt(createHash('sha256').update(key).digest('hex').slice(0, 8), 16) / 0xffffffff;
  const factor = 10 ** decimals;
  return Math.round((min + fraction * (max - min)) * factor) / factor;
}

export function seedClinical({ dataset }: SeedContext): ClinicalState {
  const now = nowIso();
  const ruleSetId = seedUuid(`clinical:rule-set:${SEED_RULE_SET.version}`);

  const questions: ClinicalQuestion[] = [];
  const rules: ClinicalRule[] = [];
  for (const question of SEED_QUESTIONS) {
    const questionId = seedUuid(`clinical:question:${question.code}`);
    questions.push({
      id: questionId,
      ruleSetId,
      code: question.code,
      step: question.step,
      order: question.order,
      text: question.text,
      helpText: question.helpText ?? null,
      type: question.type,
      options: null,
      required: question.required ?? true,
      showIfCode: question.showIf?.code ?? null,
      showIfValue: question.showIf ? question.showIf.value : null,
      active: true,
    });
    if (question.rule) {
      rules.push({
        id: seedUuid(`clinical:rule:${question.code}`),
        ruleSetId,
        questionId,
        operator: question.rule.operator,
        value: question.rule.value,
        settingKey: question.rule.settingKey ?? null,
        severity: question.rule.severity,
        message: question.rule.message,
        validationStatus: 'PENDING_VALIDATION',
        active: true,
        order: 0,
      });
    }
  }

  // --- Histórico fictício (seedHistory) --------------------------------------
  const users = new Map(dataset.users.map((user) => [user.id, user]));
  const units = new Map(dataset.units.map((unit) => [unit.id, unit]));
  const campaigns = new Map(dataset.campaigns.map((campaign) => [campaign.id, campaign]));
  const appointments = new Map(dataset.appointments.map((a) => [a.id, a]));
  const attendances: ClinicalAttendance[] = [];
  const donations: ClinicalDonation[] = [];
  for (const attendance of dataset.attendances) {
    const values: Record<string, AnswerValue> = {
      WEIGHT: pseudo(`${attendance.id}:w`, 54, 98, 1),
      BLOOD_PRESSURE: `${pseudo(`${attendance.id}:s`, 110, 130)}/${pseudo(`${attendance.id}:d`, 70, 85)}`,
      HEART_RATE: pseudo(`${attendance.id}:h`, 60, 88),
      TEMPERATURE: pseudo(`${attendance.id}:t`, 36, 36.9, 1),
      HEMOGLOBIN: pseudo(`${attendance.id}:hb`, 12.6, 15.8, 1),
    };
    const appointment = appointments.get(attendance.appointmentId);
    const attendedAt = new Date(attendance.attendedAt);
    const unitName = units.get(attendance.unitId)?.name ?? 'Unidade';
    attendances.push({
      id: attendance.id,
      appointmentId: attendance.appointmentId,
      donorId: attendance.donorId,
      unitId: attendance.unitId,
      unitName,
      campaignId: attendance.campaignId,
      campaignTitle: attendance.campaignId
        ? (campaigns.get(attendance.campaignId)?.title ?? null)
        : null,
      professionalId: attendance.professionalId,
      professionalName: users.get(attendance.professionalId)?.name ?? 'Profissional',
      result: attendance.screeningResult,
      values,
      notes: null,
      completedAt: appointment?.completedAt
        ? new Date(appointment.completedAt).toISOString()
        : new Date(attendedAt.getTime() + 15 * 60_000).toISOString(),
      createdAt: attendedAt.toISOString(),
    });
    const donation = attendance.donation;
    if (donation) {
      const occurredAt = new Date(donation.occurredAt).toISOString();
      donations.push({
        id: donation.id,
        code: donation.code,
        attendanceId: attendance.id,
        donorId: attendance.donorId,
        unitId: attendance.unitId,
        unitName,
        campaignId: attendance.campaignId,
        professionalId: attendance.professionalId,
        bloodType: donation.bloodType,
        volumeMl: donation.volumeMl,
        status: donation.status,
        notes: null,
        occurredAt,
        nextEligibleAt:
          donation.status === 'COMPLETED'
            ? nextEligibleDate(occurredAt, DEFAULT_SETTINGS.donationIntervalDays)
            : null,
        createdAt: occurredAt,
      });
    }
  }

  return {
    settings: [
      {
        key: SETTING_KEYS.donationIntervalDays,
        value: DEFAULT_SETTINGS.donationIntervalDays,
        validationStatus: 'PENDING_VALIDATION',
        updatedById: null,
        updatedAt: now,
      },
      {
        key: SETTING_KEYS.preScreeningValidityDays,
        value: DEFAULT_SETTINGS.preScreeningValidityDays,
        validationStatus: null,
        updatedById: null,
        updatedAt: now,
      },
    ],
    ruleSets: [
      {
        id: ruleSetId,
        version: SEED_RULE_SET.version,
        status: 'ACTIVE',
        validationStatus: 'PENDING_VALIDATION',
        normativeReference: SEED_RULE_SET.normativeReference,
        publishedAt: now,
        createdAt: now,
      },
    ],
    questions,
    rules,
    preScreenings: [],
    fields: SEED_FIELDS.map((field) => ({
      id: seedUuid(`clinical:field:${field.code}`),
      code: field.code,
      label: field.label,
      type: field.type,
      unit: field.unit,
      options: null,
      helpText: field.helpText,
      required: true,
      min: field.min,
      max: field.max,
      order: field.order,
      active: true,
    })),
    attendances,
    donations,
    documents: [],
    deletedUsers: [],
  };
}

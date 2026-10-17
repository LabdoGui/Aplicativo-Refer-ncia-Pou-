import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  APP_CONFIG,
  buildSeedDataset,
  FieldEncryption,
  seedUuid,
  type SeedDataset,
} from '@pulso/common';
import type { AnswerValue } from '@pulso/contracts';
import type { ClinicalEnv } from '../config';
import { nextEligibleDate } from '../donations/eligibility';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_SETTINGS, SETTING_KEYS } from '../settings/settings.service';
import { SEED_FIELDS, SEED_QUESTIONS, SEED_RULE_SET } from './seed-content';

/** Valor fictício estável por atendimento (mesmo resultado a cada seed). */
function pseudo(key: string, min: number, max: number, decimals = 0): number {
  const fraction =
    parseInt(createHash('sha256').update(key).digest('hex').slice(0, 8), 16) / 0xffffffff;
  const factor = 10 ** decimals;
  return Math.round((min + fraction * (max - min)) * factor) / factor;
}

/**
 * Grava o questionário, os campos, as configurações e o histórico fictício de
 * atendimentos e doações quando o banco está vazio (SEED_DEMO_DATA=true).
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryption,
    @Inject(APP_CONFIG) private readonly config: ClinicalEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DEMO_DATA) return;
    if ((await this.prisma.screeningRuleSet.count()) > 0) return;
    const dataset = buildSeedDataset();
    await this.prisma.$transaction(
      async (tx) => {
        await tx.clinicalSetting.createMany({
          data: [
            {
              key: SETTING_KEYS.donationIntervalDays,
              value: DEFAULT_SETTINGS.donationIntervalDays,
              validationStatus: 'PENDING_VALIDATION',
            },
            {
              key: SETTING_KEYS.preScreeningValidityDays,
              value: DEFAULT_SETTINGS.preScreeningValidityDays,
            },
          ],
        });

        const ruleSetId = seedUuid(`clinical:rule-set:${SEED_RULE_SET.version}`);
        await tx.screeningRuleSet.create({
          data: {
            id: ruleSetId,
            version: SEED_RULE_SET.version,
            status: 'ACTIVE',
            validationStatus: 'PENDING_VALIDATION',
            normativeReference: SEED_RULE_SET.normativeReference,
            publishedAt: new Date(),
          },
        });
        for (const question of SEED_QUESTIONS) {
          const questionId = seedUuid(`clinical:question:${question.code}`);
          await tx.screeningQuestion.create({
            data: {
              id: questionId,
              ruleSetId,
              code: question.code,
              step: question.step,
              order: question.order,
              text: question.text,
              helpText: question.helpText ?? null,
              type: question.type,
              required: question.required ?? true,
              showIfCode: question.showIf?.code ?? null,
              showIfValue: question.showIf ? question.showIf.value : undefined,
            },
          });
          if (question.rule) {
            await tx.screeningRule.create({
              data: {
                id: seedUuid(`clinical:rule:${question.code}`),
                ruleSetId,
                questionId,
                operator: question.rule.operator,
                value: question.rule.value,
                settingKey: question.rule.settingKey ?? null,
                severity: question.rule.severity,
                message: question.rule.message,
                validationStatus: 'PENDING_VALIDATION',
              },
            });
          }
        }

        await tx.professionalScreeningField.createMany({
          data: SEED_FIELDS.map((field) => ({
            id: seedUuid(`clinical:field:${field.code}`),
            code: field.code,
            label: field.label,
            type: field.type,
            unit: field.unit,
            helpText: field.helpText,
            required: true,
            min: field.min,
            max: field.max,
            order: field.order,
          })),
        });

        await this.seedHistory(tx, dataset);
      },
      { timeout: 120_000 },
    );
    this.logger.log(
      { attendances: dataset.attendances.length },
      'Dados fictícios de demonstração gravados',
    );
  }

  private async seedHistory(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    dataset: SeedDataset,
  ): Promise<void> {
    const users = new Map(dataset.users.map((user) => [user.id, user]));
    const units = new Map(dataset.units.map((unit) => [unit.id, unit]));
    const campaigns = new Map(dataset.campaigns.map((campaign) => [campaign.id, campaign]));
    const appointments = new Map(dataset.appointments.map((a) => [a.id, a]));

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
      await tx.professionalScreening.create({
        data: {
          id: attendance.id,
          appointmentId: attendance.appointmentId,
          donorId: attendance.donorId,
          unitId: attendance.unitId,
          unitName: units.get(attendance.unitId)?.name ?? 'Unidade',
          campaignId: attendance.campaignId,
          campaignTitle: attendance.campaignId
            ? (campaigns.get(attendance.campaignId)?.title ?? null)
            : null,
          professionalId: attendance.professionalId,
          professionalName: users.get(attendance.professionalId)?.name ?? 'Profissional',
          result: attendance.screeningResult,
          valuesEncrypted: this.encryption.encryptJson(values),
          completedAt: appointment?.completedAt
            ? new Date(appointment.completedAt)
            : new Date(attendedAt.getTime() + 15 * 60_000),
          createdAt: attendedAt,
        },
      });
      const donation = attendance.donation;
      if (donation) {
        const occurredAt = new Date(donation.occurredAt);
        await tx.donation.create({
          data: {
            id: donation.id,
            code: donation.code,
            attendanceId: attendance.id,
            donorId: attendance.donorId,
            unitId: attendance.unitId,
            unitName: units.get(attendance.unitId)?.name ?? 'Unidade',
            campaignId: attendance.campaignId,
            professionalId: attendance.professionalId,
            bloodType: donation.bloodType,
            volumeMl: donation.volumeMl,
            status: donation.status,
            occurredAt,
            nextEligibleAt:
              donation.status === 'COMPLETED'
                ? new Date(
                    `${nextEligibleDate(occurredAt, DEFAULT_SETTINGS.donationIntervalDays)}T00:00:00Z`,
                  )
                : null,
            createdAt: occurredAt,
          },
        });
      }
    }
  }
}

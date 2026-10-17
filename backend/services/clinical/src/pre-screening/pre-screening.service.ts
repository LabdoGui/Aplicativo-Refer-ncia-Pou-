import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  AppException,
  AuditService,
  FieldEncryption,
  todayLocal,
  toLocalDate,
} from '@pulso/common';
import {
  PRE_SCREENING_DISCLAIMER,
  type AnswerValue,
  type AuthUser,
  type PreScreeningGuidance,
  type PreScreeningQuestionnaire,
  type PreScreeningResultView,
  type SharedPreScreeningView,
} from '@pulso/contracts';
import type { PreScreening, ScreeningRuleSet } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { PreScreeningSubmitDto } from './dto/pre-screening.dto';
import { toEngineQuestion, toEngineRule, toQuestionView } from './mappers';
import { answerLabel, evaluateRules, sanitizeAnswers, sortQuestions } from './rule-engine';
import { PRE_SCREENING_STEPS } from './steps';

type PreScreeningWithSet = PreScreening & { ruleSet: ScreeningRuleSet };

@Injectable()
export class PreScreeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryption,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async questionnaire(): Promise<PreScreeningQuestionnaire> {
    const ruleSet = await this.activeRuleSet();
    return {
      ruleSetId: ruleSet.id,
      ruleSetVersion: ruleSet.version,
      validationStatus: ruleSet.validationStatus,
      normativeReference: ruleSet.normativeReference,
      disclaimer: PRE_SCREENING_DISCLAIMER,
      steps: PRE_SCREENING_STEPS,
      questions: sortQuestions(ruleSet.questions).map(toQuestionView),
    };
  }

  async submit(
    actor: AuthUser,
    dto: PreScreeningSubmitDto,
    requestId?: string,
  ): Promise<PreScreeningResultView> {
    const ruleSet = await this.activeRuleSet();
    const questions = ruleSet.questions.map(toEngineQuestion);
    const today = todayLocal();
    const { answers, errors } = sanitizeAnswers(questions, dto.answers, today);
    if (errors.length > 0) {
      throw new AppException(
        400,
        'VALIDATION_ERROR',
        'Algumas respostas precisam de correção.',
        'Dados inválidos',
        errors,
      );
    }
    const settings = await this.settings.get();
    const evaluation = evaluateRules(
      questions,
      ruleSet.rules.map(toEngineRule),
      answers,
      await this.settings.numericValues(),
      today,
    );
    const now = new Date();
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.preScreening.create({
        data: {
          donorId: actor.id,
          ruleSetId: ruleSet.id,
          result: evaluation.result,
          triggeredRuleIds: evaluation.triggeredRuleIds,
          guidanceEncrypted: this.encryption.encryptJson(evaluation.guidance),
          // UC03: sem consentimento de compartilhamento, as respostas não são guardadas.
          answersEncrypted: dto.shareWithStaff ? this.encryption.encryptJson(answers) : null,
          sharedWithStaff: dto.shareWithStaff,
          waitUntil: evaluation.waitUntil ? new Date(`${evaluation.waitUntil}T00:00:00Z`) : null,
          expiresAt: DateTime.fromJSDate(now)
            .plus({ days: settings.preScreeningValidityDays })
            .toJSDate(),
        },
        include: { ruleSet: true },
      });
      await this.audit.record(
        {
          actor,
          action: 'prescreening.submitted',
          entity: 'pre_screening',
          entityId: created.id,
          metadata: { result: evaluation.result, shared: dto.shareWithStaff },
          requestId,
        },
        tx,
      );
      return created;
    });
    return this.toResultView(record);
  }

  async latest(actor: AuthUser): Promise<PreScreeningResultView | null> {
    const record = await this.prisma.preScreening.findFirst({
      where: { donorId: actor.id },
      orderBy: { createdAt: 'desc' },
      include: { ruleSet: true },
    });
    return record ? this.toResultView(record) : null;
  }

  /** Revoga o compartilhamento: as respostas guardadas são apagadas (não há como reativar). */
  async revokeSharing(
    actor: AuthUser,
    id: string,
    requestId?: string,
  ): Promise<PreScreeningResultView> {
    const record = await this.prisma.preScreening.findUnique({
      where: { id },
      include: { ruleSet: true },
    });
    if (!record || record.donorId !== actor.id) {
      throw new AppException(404, 'PRESCREENING_NOT_FOUND', 'Pré-triagem não encontrada.');
    }
    if (!record.sharedWithStaff && !record.answersEncrypted) return this.toResultView(record);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.preScreening.update({
        where: { id },
        data: { sharedWithStaff: false, answersEncrypted: null },
        include: { ruleSet: true },
      });
      await this.audit.record(
        {
          actor,
          action: 'prescreening.sharing_revoked',
          entity: 'pre_screening',
          entityId: id,
          requestId,
        },
        tx,
      );
      return row;
    });
    return this.toResultView(updated);
  }

  /**
   * Última pré-triagem compartilhada do doador feita até o dia do atendimento
   * (vencida aparece marcada como tal).
   */
  async sharedForStaff(
    donorId: string,
    appointmentStartsAt: string,
  ): Promise<SharedPreScreeningView | null> {
    const appointmentDay = toLocalDate(appointmentStartsAt);
    const endOfDay = DateTime.fromISO(appointmentDay, { zone: 'America/Sao_Paulo' })
      .endOf('day')
      .toJSDate();
    const record = await this.prisma.preScreening.findFirst({
      where: {
        donorId,
        sharedWithStaff: true,
        answersEncrypted: { not: null },
        createdAt: { lte: endOfDay },
      },
      orderBy: { createdAt: 'desc' },
      include: { ruleSet: { include: { questions: true } } },
    });
    if (!record || !record.answersEncrypted) return null;
    const answers = this.encryption.decryptJson<Record<string, AnswerValue>>(
      record.answersEncrypted,
    );
    const questions = sortQuestions(record.ruleSet.questions.map(toEngineQuestion));
    return {
      id: record.id,
      result: record.result,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      expired: record.expiresAt <= new Date(),
      guidance: this.encryption.decryptJson<PreScreeningGuidance[]>(record.guidanceEncrypted),
      answers: questions
        .filter((question) => answers[question.code] !== undefined)
        .map((question) => ({
          step: question.step,
          question: question.text,
          answer: answerLabel(question, answers[question.code]),
        })),
    };
  }

  private async activeRuleSet() {
    const ruleSet = await this.prisma.screeningRuleSet.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        questions: { where: { active: true } },
        rules: { where: { active: true } },
      },
    });
    if (!ruleSet || ruleSet.questions.length === 0) {
      throw new AppException(
        409,
        'PRESCREENING_UNAVAILABLE',
        'A pré-triagem está indisponível no momento. Você ainda pode agendar sua doação.',
      );
    }
    return ruleSet;
  }

  private toResultView(record: PreScreeningWithSet): PreScreeningResultView {
    return {
      id: record.id,
      result: record.result,
      guidance: this.encryption.decryptJson<PreScreeningGuidance[]>(record.guidanceEncrypted),
      waitUntil: record.waitUntil ? record.waitUntil.toISOString().slice(0, 10) : null,
      sharedWithStaff: record.sharedWithStaff,
      ruleSetVersion: record.ruleSet.version,
      validationStatus: record.ruleSet.validationStatus,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      expired: record.expiresAt <= new Date(),
    };
  }
}

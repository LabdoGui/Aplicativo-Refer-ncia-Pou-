/**
 * Pré-triagem informativa (espelho de pre-screening/*). O motor de regras é o
 * mesmo do back-end (rule-engine.ts, funções puras importadas daqui).
 */
import { DateTime } from 'luxon';
import {
  PRE_SCREENING_DISCLAIMER,
  type AnswerValue,
  type AuthUser,
  type PreScreeningQuestion,
  type PreScreeningQuestionnaire,
  type PreScreeningResultView,
  type ScreeningRuleView,
  type SharedPreScreeningView,
} from '@pulso/contracts';
import {
  answerLabel,
  evaluateRules,
  sanitizeAnswers,
  sortQuestions,
  type EngineQuestion,
  type EngineRule,
} from '@backend/services/clinical/src/pre-screening/rule-engine';
import { PRE_SCREENING_STEPS } from '@backend/services/clinical/src/pre-screening/steps';
import { recordAudit } from '../../core/audit';
import { fail, noContent, route, type AuthedRequest } from '../../core/http';
import { nowIso, todayLocal, toLocalDate, uuid } from '../../core/support';
import { getSettings, numericSettings } from './settings';
import {
  clinical,
  SERVICE,
  type ClinicalPreScreening,
  type ClinicalQuestion,
  type ClinicalRule,
  type ClinicalRuleSet,
} from './state';
import { asBoolean, assertCanWrite, bodyOf, Checker, uuidParam } from './validation';

// --- Mapeadores (pre-screening/mappers.ts) ----------------------------------

function answerValue(value: unknown): AnswerValue | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : null;
}

export function toEngineQuestion(question: ClinicalQuestion): EngineQuestion {
  return {
    id: question.id,
    code: question.code,
    step: question.step,
    order: question.order,
    text: question.text,
    type: question.type,
    options: question.options,
    required: question.required,
    showIfCode: question.showIfCode,
    showIfValue: answerValue(question.showIfValue),
  };
}

function toEngineRule(rule: ClinicalRule): EngineRule {
  return {
    id: rule.id,
    questionId: rule.questionId,
    operator: rule.operator,
    value: rule.value,
    settingKey: rule.settingKey,
    severity: rule.severity,
    message: rule.message,
    order: rule.order,
  };
}

export function toQuestionView(question: ClinicalQuestion): PreScreeningQuestion {
  const showIfValue = answerValue(question.showIfValue);
  return {
    id: question.id,
    code: question.code,
    step: question.step,
    order: question.order,
    text: question.text,
    helpText: question.helpText,
    type: question.type,
    options: question.options,
    required: question.required,
    showIf:
      question.showIfCode && (typeof showIfValue === 'string' || typeof showIfValue === 'boolean')
        ? { questionCode: question.showIfCode, equals: showIfValue }
        : null,
  };
}

export function toRuleView(
  rule: ClinicalRule,
  question: Pick<ClinicalQuestion, 'code' | 'text'>,
): ScreeningRuleView {
  return {
    id: rule.id,
    questionCode: question.code,
    questionText: question.text,
    operator: rule.operator,
    value: answerValue(rule.value) ?? '',
    settingKey: rule.settingKey,
    severity: rule.severity,
    message: rule.message,
    validationStatus: rule.validationStatus,
    active: rule.active,
  };
}

// --- Serviço ------------------------------------------------------------------

/** Respostas como a equipe as vê: etapa, texto da pergunta e resposta legível. */
function sharedAnswers(
  questions: EngineQuestion[],
  answers: Record<string, AnswerValue>,
): SharedPreScreeningView['answers'] {
  return sortQuestions(questions)
    .filter((question) => answers[question.code] !== undefined)
    .map((question) => ({
      step: question.step,
      question: question.text,
      answer: answerLabel(question, answers[question.code]),
    }));
}

function activeRuleSet(): {
  ruleSet: ClinicalRuleSet;
  questions: ClinicalQuestion[];
  rules: ClinicalRule[];
} {
  const state = clinical();
  const ruleSet = state.ruleSets.find((candidate) => candidate.status === 'ACTIVE');
  const questions = ruleSet
    ? state.questions.filter((q) => q.ruleSetId === ruleSet.id && q.active)
    : [];
  if (!ruleSet || questions.length === 0) {
    fail(
      409,
      'PRESCREENING_UNAVAILABLE',
      'A pré-triagem está indisponível no momento. Você ainda pode agendar sua doação.',
    );
  }
  const rules = state.rules.filter((rule) => rule.ruleSetId === ruleSet.id && rule.active);
  return { ruleSet, questions, rules };
}

function toResultView(record: ClinicalPreScreening): PreScreeningResultView {
  const ruleSet = clinical().ruleSets.find((candidate) => candidate.id === record.ruleSetId);
  return {
    id: record.id,
    result: record.result,
    guidance: record.guidance,
    waitUntil: record.waitUntil,
    sharedWithStaff: record.sharedWithStaff,
    ruleSetVersion: record.ruleSetVersion ?? ruleSet?.version ?? '',
    validationStatus: ruleSet?.validationStatus ?? 'PENDING_VALIDATION',
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    expired: Date.parse(record.expiresAt) <= Date.now(),
  };
}

function questionnaire(): PreScreeningQuestionnaire {
  const { ruleSet, questions } = activeRuleSet();
  return {
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
    validationStatus: ruleSet.validationStatus,
    normativeReference: ruleSet.normativeReference,
    disclaimer: PRE_SCREENING_DISCLAIMER,
    steps: PRE_SCREENING_STEPS,
    questions: sortQuestions(questions).map(toQuestionView),
  };
}

function submit(actor: AuthUser, input: unknown): PreScreeningResultView {
  const body = bodyOf(input);
  const check = new Checker(body, ['answers', 'shareWithStaff']);
  const shareWithStaff = asBoolean(body.shareWithStaff);
  check.object('answers', body.answers);
  check.boolean('shareWithStaff', shareWithStaff);
  check.done();
  const dto = {
    answers: body.answers as Record<string, unknown>,
    shareWithStaff: shareWithStaff as boolean,
  };

  const { ruleSet, questions: rows, rules } = activeRuleSet();
  const questions = rows.map(toEngineQuestion);
  const today = todayLocal();
  const { answers, errors } = sanitizeAnswers(questions, dto.answers, today);
  if (errors.length > 0) {
    fail(400, 'VALIDATION_ERROR', 'Algumas respostas precisam de correção.', 'Dados inválidos', errors);
  }
  const settings = getSettings();
  const evaluation = evaluateRules(
    questions,
    rules.map(toEngineRule),
    answers,
    numericSettings(),
    today,
  );
  const now = new Date();
  const record: ClinicalPreScreening = {
    id: uuid(),
    donorId: actor.id,
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
    result: evaluation.result,
    triggeredRuleIds: evaluation.triggeredRuleIds,
    guidance: evaluation.guidance,
    // UC03: sem consentimento de compartilhamento, as respostas não são guardadas.
    // Guardadas com o texto da pergunta da época (RN08).
    answers: dto.shareWithStaff ? sharedAnswers(questions, answers) : null,
    sharedWithStaff: dto.shareWithStaff,
    waitUntil: evaluation.waitUntil,
    createdAt: now.toISOString(),
    expiresAt: DateTime.fromJSDate(now)
      .plus({ days: settings.preScreeningValidityDays })
      .toJSDate()
      .toISOString(),
  };
  clinical().preScreenings.push(record);
  recordAudit(SERVICE, {
    actor,
    action: 'prescreening.submitted',
    entity: 'pre_screening',
    entityId: record.id,
    // Sem o resultado (dado de saúde): a trilha registra o fato e o compartilhamento.
    metadata: { shared: dto.shareWithStaff },
  });
  return toResultView(record);
}

/** Pré-triagens de um doador, da mais recente para a mais antiga. */
export function preScreeningsOf(donorId: string): ClinicalPreScreening[] {
  return clinical()
    .preScreenings.filter((record) => record.donorId === donorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function latest(actor: AuthUser) {
  const record = preScreeningsOf(actor.id)[0];
  return record ? toResultView(record) : noContent();
}

/** Revoga o compartilhamento: as respostas guardadas são apagadas (não há como reativar). */
function revokeSharing(actor: AuthUser, id: string, input: unknown): PreScreeningResultView {
  const body = bodyOf(input);
  const check = new Checker(body, ['shared']);
  const shared = asBoolean(body.shared);
  if (shared !== false) check.add('shared', 'Só é possível revogar o compartilhamento.');
  check.boolean('shared', shared);
  check.done();

  const record = clinical().preScreenings.find((candidate) => candidate.id === id);
  if (!record || record.donorId !== actor.id) {
    fail(404, 'PRESCREENING_NOT_FOUND', 'Pré-triagem não encontrada.');
  }
  if (!record.sharedWithStaff && !record.answers) return toResultView(record);
  record.sharedWithStaff = false;
  record.answers = null;
  recordAudit(SERVICE, {
    actor,
    action: 'prescreening.sharing_revoked',
    entity: 'pre_screening',
    entityId: id,
  });
  return toResultView(record);
}

/**
 * Pré-triagem mais recente do doador feita até o dia do atendimento, se ele a
 * compartilhou e ela ainda está válida. Uma pré-triagem mais nova, não
 * compartilhada, substitui as anteriores: a equipe nunca vê respostas antigas.
 */
export function sharedForStaff(
  donorId: string,
  appointmentStartsAt: string,
): SharedPreScreeningView | null {
  const appointmentDay = toLocalDate(appointmentStartsAt);
  const endOfDay = DateTime.fromISO(appointmentDay, { zone: 'America/Sao_Paulo' })
    .endOf('day')
    .toMillis();
  const record = preScreeningsOf(donorId).find(
    (candidate) => Date.parse(candidate.createdAt) <= endOfDay,
  );
  if (!record || !record.sharedWithStaff || !record.answers) return null;
  if (Date.parse(record.expiresAt) <= Date.now()) return null;
  return {
    id: record.id,
    result: record.result,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    guidance: record.guidance,
    answers: record.answers,
  };
}

/**
 * Minimização (LGPD, privacy/answers-retention.job.ts): depois da validade, as
 * respostas compartilhadas são apagadas. Fica só o resultado, para as estatísticas.
 */
export function purgeExpiredAnswers(now = nowIso()): number {
  let count = 0;
  for (const record of clinical().preScreenings) {
    if (record.answers !== null && record.expiresAt < now) {
      record.answers = null;
      record.sharedWithStaff = false;
      count += 1;
    }
  }
  return count;
}

export function registerPreScreening(): void {
  const options = { permissions: ['self:prescreening' as const] };
  route('GET', '/screenings/questionnaire', () => questionnaire(), options);
  route(
    'POST',
    '/screenings/pre-check',
    (request: AuthedRequest) => {
      assertCanWrite(request.user);
      return submit(request.user, request.body);
    },
    options,
  );
  route('GET', '/screenings/pre-check/me/latest', (request) => latest(request.user), options);
  route(
    'PATCH',
    '/screenings/pre-check/:id/sharing',
    (request) => {
      assertCanWrite(request.user);
      const id = uuidParam(request.params.id);
      return revokeSharing(request.user, id, request.body);
    },
    options,
  );
}

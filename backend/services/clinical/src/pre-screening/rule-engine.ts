/**
 * Motor de regras da pré-triagem (funções puras, testadas em rule-engine.spec.ts).
 *
 * RN07: o resultado só orienta. A regra mais severa disparada define o
 * resultado (AGUARDAR > CONVERSAR COM A UNIDADE > PODE SEGUIR); regras
 * INFORMATIVAS só acrescentam orientações. Nenhuma regra bloqueia o agendamento.
 */
import { DateTime } from 'luxon';
import {
  DEFAULT_TIMEZONE,
  type AnswerValue,
  type PreScreeningGuidance,
  type PreScreeningResult,
  type QuestionOption,
  type QuestionType,
  type RuleOperator,
  type RuleSeverity,
} from '@pulso/contracts';

export interface EngineQuestion {
  id: string;
  code: string;
  step: number;
  order: number;
  text: string;
  type: QuestionType;
  options: QuestionOption[] | null;
  required: boolean;
  showIfCode: string | null;
  showIfValue: AnswerValue | null;
}

export interface EngineRule {
  id: string;
  questionId: string;
  operator: RuleOperator;
  value: unknown;
  settingKey: string | null;
  severity: RuleSeverity;
  message: string;
  order: number;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface Evaluation {
  result: PreScreeningResult;
  guidance: PreScreeningGuidance[];
  waitUntil: string | null;
  triggeredRuleIds: string[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Limite contra valores absurdos em perguntas numéricas. */
const NUMBER_LIMIT = 1_000_000;

export function sortQuestions<T extends { step: number; order: number }>(questions: T[]): T[] {
  return [...questions].sort((a, b) => a.step - b.step || a.order - b.order);
}

/**
 * Valida as respostas contra as perguntas ativas. Respostas de perguntas
 * escondidas pela condição (`showIf`) são descartadas; códigos desconhecidos e
 * respostas obrigatórias ausentes viram erros por campo.
 */
export function sanitizeAnswers(
  questions: EngineQuestion[],
  answers: Record<string, unknown>,
  today: string,
): { answers: Record<string, AnswerValue>; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const byCode = new Map(questions.map((question) => [question.code, question]));
  for (const code of Object.keys(answers)) {
    if (!byCode.has(code))
      errors.push({ field: `answers.${code}`, message: 'Pergunta desconhecida.' });
  }

  const clean: Record<string, AnswerValue> = {};
  for (const question of sortQuestions(questions)) {
    const field = `answers.${question.code}`;
    if (question.showIfCode) {
      // A condição usa a resposta já validada da pergunta-mãe (que vem antes na ordem).
      const parent = clean[question.showIfCode];
      if (parent === undefined || parent !== question.showIfValue) continue;
    }
    const raw = answers[question.code];
    if (raw === undefined || raw === null || raw === '') {
      if (question.required) errors.push({ field, message: 'Responda esta pergunta.' });
      continue;
    }
    const value = validateAnswer(question, raw, today);
    if (typeof value === 'object') {
      errors.push({ field, message: value.error });
      continue;
    }
    clean[question.code] = value;
  }
  return { answers: clean, errors };
}

function validateAnswer(
  question: EngineQuestion,
  raw: unknown,
  today: string,
): AnswerValue | { error: string } {
  switch (question.type) {
    case 'BOOLEAN':
      return typeof raw === 'boolean' ? raw : { error: 'Responda com sim ou não.' };
    case 'SINGLE_CHOICE':
      return typeof raw === 'string' && (question.options ?? []).some((o) => o.value === raw)
        ? raw
        : { error: 'Escolha uma das opções.' };
    case 'NUMBER':
      return typeof raw === 'number' && Number.isFinite(raw) && Math.abs(raw) <= NUMBER_LIMIT
        ? raw
        : { error: 'Informe um número válido.' };
    case 'DATE': {
      if (typeof raw !== 'string' || !DATE_PATTERN.test(raw) || !DateTime.fromISO(raw).isValid) {
        return { error: 'Informe uma data válida (AAAA-MM-DD).' };
      }
      if (raw > today) return { error: 'A data não pode ser futura.' };
      if (raw < '1900-01-01') return { error: 'Confira a data informada.' };
      return raw;
    }
  }
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Dias da janela de uma regra WITHIN_DAYS: valor fixo ou configuração nomeada. */
export function windowDays(rule: EngineRule, settings: Record<string, number>): number | undefined {
  if (rule.settingKey) return numeric(settings[rule.settingKey]);
  return numeric(rule.value);
}

export function formatDateBr(date: string): string {
  return DateTime.fromISO(date).toFormat('dd/MM/yyyy');
}

/** Avalia uma regra. Devolve `waitUntil` (AAAA-MM-DD) quando a regra é de espera. */
export function evaluateRule(
  rule: EngineRule,
  answer: AnswerValue | undefined,
  settings: Record<string, number>,
  today: string,
): { triggered: boolean; waitUntil: string | null } {
  const miss = { triggered: false, waitUntil: null };
  if (answer === undefined) return miss;
  const expected = rule.value;
  switch (rule.operator) {
    case 'EQUALS':
      return { triggered: answer === expected, waitUntil: null };
    case 'NOT_EQUALS':
      return { triggered: answer !== expected, waitUntil: null };
    case 'LT':
    case 'LTE':
    case 'GT':
    case 'GTE': {
      const left = numeric(answer);
      const right = numeric(expected);
      if (left === undefined || right === undefined) return miss;
      const triggered =
        rule.operator === 'LT'
          ? left < right
          : rule.operator === 'LTE'
            ? left <= right
            : rule.operator === 'GT'
              ? left > right
              : left >= right;
      return { triggered, waitUntil: null };
    }
    case 'WITHIN_DAYS': {
      const days = windowDays(rule, settings);
      if (typeof answer !== 'string' || days === undefined) return miss;
      const answered = DateTime.fromISO(answer, { zone: DEFAULT_TIMEZONE });
      const reference = DateTime.fromISO(today, { zone: DEFAULT_TIMEZONE });
      if (!answered.isValid || answered > reference) return miss;
      const until = answered.plus({ days });
      if (until <= reference) return miss;
      return {
        triggered: true,
        waitUntil: rule.severity === 'WAIT_UNTIL' ? until.toISODate() : null,
      };
    }
  }
}

const SEVERITY_RANK: Record<RuleSeverity, number> = { INFO: 0, TALK_TO_UNIT: 1, WAIT_UNTIL: 2 };

/** Aplica as regras ativas às respostas já validadas. */
export function evaluateRules(
  questions: EngineQuestion[],
  rules: EngineRule[],
  answers: Record<string, AnswerValue>,
  settings: Record<string, number>,
  today: string,
): Evaluation {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const ordered = [...rules].sort((a, b) => {
    const qa = questionById.get(a.questionId);
    const qb = questionById.get(b.questionId);
    return (
      (qa?.step ?? 0) - (qb?.step ?? 0) || (qa?.order ?? 0) - (qb?.order ?? 0) || a.order - b.order
    );
  });

  const guidance: PreScreeningGuidance[] = [];
  const triggeredRuleIds: string[] = [];
  let highest = -1;
  let waitUntil: string | null = null;

  for (const rule of ordered) {
    const question = questionById.get(rule.questionId);
    if (!question) continue;
    const outcome = evaluateRule(rule, answers[question.code], settings, today);
    if (!outcome.triggered) continue;
    triggeredRuleIds.push(rule.id);
    highest = Math.max(highest, SEVERITY_RANK[rule.severity]);
    if (outcome.waitUntil && (!waitUntil || outcome.waitUntil > waitUntil)) {
      waitUntil = outcome.waitUntil;
    }
    guidance.push({
      severity: rule.severity,
      message: outcome.waitUntil
        ? rule.message.replace(/\{date\}/g, formatDateBr(outcome.waitUntil))
        : rule.message.replace(/\{date\}/g, '').trim(),
      waitUntil: outcome.waitUntil,
    });
  }

  const result: PreScreeningResult =
    highest === SEVERITY_RANK.WAIT_UNTIL
      ? 'WAIT_UNTIL'
      : highest === SEVERITY_RANK.TALK_TO_UNIT
        ? 'TALK_TO_UNIT'
        : 'FAVORABLE';
  return { result, guidance, waitUntil, triggeredRuleIds };
}

/** Texto legível de uma resposta (visão da equipe). */
export function answerLabel(question: EngineQuestion, value: AnswerValue): string {
  switch (question.type) {
    case 'BOOLEAN':
      return value === true ? 'Sim' : 'Não';
    case 'SINGLE_CHOICE':
      return question.options?.find((option) => option.value === value)?.label ?? String(value);
    case 'DATE':
      return typeof value === 'string' ? formatDateBr(value) : String(value);
    default:
      return String(value);
  }
}

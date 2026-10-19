/**
 * Regras do formulário da pré-triagem (funções puras): perguntas condicionais,
 * validação por etapa e montagem das respostas no formato da API
 * (clinical/pre-screening/rule-engine.ts → sanitizeAnswers).
 */
import type {
  AnswerValue,
  PreScreeningQuestion,
  PreScreeningQuestionnaire,
  PreScreeningStep,
} from '@pulso/contracts';

/** Rascunho: booleano (sim/não) ou texto (opção, número digitado, data AAAA-MM-DD). */
export type DraftValue = string | boolean;
export type Draft = Record<string, DraftValue>;
export type QuestionErrors = Record<string, string>;

export interface WizardStep extends PreScreeningStep {
  questions: PreScreeningQuestion[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Mesmo limite do servidor contra valores absurdos em perguntas numéricas. */
const NUMBER_LIMIT = 1_000_000;

export function sortQuestions(questions: PreScreeningQuestion[]): PreScreeningQuestion[] {
  return [...questions].sort((a, b) => a.step - b.step || a.order - b.order);
}

/** Etapas com perguntas, cada uma com as suas perguntas em ordem. */
export function wizardSteps(questionnaire: PreScreeningQuestionnaire): WizardStep[] {
  const sorted = sortQuestions(questionnaire.questions);
  return [...questionnaire.steps]
    .sort((a, b) => a.step - b.step)
    .map((step) => ({ ...step, questions: sorted.filter((q) => q.step === step.step) }))
    .filter((step) => step.questions.length > 0);
}

/** Valor enviado à API para a resposta do rascunho (undefined = sem resposta válida). */
export function toAnswer(
  question: PreScreeningQuestion,
  raw: DraftValue | undefined,
): AnswerValue | undefined {
  if (raw === undefined || raw === '') return undefined;
  switch (question.type) {
    case 'BOOLEAN':
      return typeof raw === 'boolean' ? raw : undefined;
    case 'NUMBER': {
      const value = typeof raw === 'string' ? Number(raw.replace(',', '.')) : Number.NaN;
      return Number.isFinite(value) ? value : undefined;
    }
    case 'SINGLE_CHOICE':
    case 'DATE':
      return typeof raw === 'string' ? raw : undefined;
  }
}

/** A pergunta aparece? (a condição usa a resposta da pergunta-mãe, também visível). */
export function isVisible(
  question: PreScreeningQuestion,
  draft: Draft,
  byCode: Map<string, PreScreeningQuestion>,
): boolean {
  if (!question.showIf) return true;
  const parent = byCode.get(question.showIf.questionCode);
  if (!parent || !isVisible(parent, draft, byCode)) return false;
  return toAnswer(parent, draft[parent.code]) === question.showIf.equals;
}

export const indexByCode = (questions: PreScreeningQuestion[]) =>
  new Map(questions.map((question) => [question.code, question]));

/** Descarta as respostas de perguntas que ficaram escondidas pela condição. */
export function pruneHidden(questions: PreScreeningQuestion[], draft: Draft): Draft {
  const byCode = indexByCode(questions);
  const next = { ...draft };
  let changed = false;
  for (const question of sortQuestions(questions)) {
    if (question.code in next && !isVisible(question, next, byCode)) {
      delete next[question.code];
      changed = true;
    }
  }
  return changed ? next : draft;
}

/** Mensagem de erro de uma resposta (undefined = válida ou opcional em branco). */
export function validateQuestion(
  question: PreScreeningQuestion,
  raw: DraftValue | undefined,
  today: string,
): string | undefined {
  if (raw === undefined || raw === '') {
    if (!question.required) return undefined;
    return question.type === 'BOOLEAN' || question.type === 'SINGLE_CHOICE'
      ? 'Escolha uma opção.'
      : 'Responda esta pergunta.';
  }
  const value = toAnswer(question, raw);
  switch (question.type) {
    case 'NUMBER':
      if (typeof value !== 'number') return 'Informe um número válido.';
      return Math.abs(value) > NUMBER_LIMIT ? 'Confira o número informado.' : undefined;
    case 'DATE':
      if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return 'Informe uma data válida.';
      if (value > today) return 'A data não pode ser futura.';
      return value < '1900-01-01' ? 'Confira a data informada.' : undefined;
    default:
      return value === undefined ? 'Escolha uma opção.' : undefined;
  }
}

/** Perguntas visíveis de uma etapa. */
export function visibleQuestions(
  step: WizardStep,
  allQuestions: PreScreeningQuestion[],
  draft: Draft,
): PreScreeningQuestion[] {
  const byCode = indexByCode(allQuestions);
  return step.questions.filter((question) => isVisible(question, draft, byCode));
}

/** Erros das perguntas visíveis de uma etapa. */
export function validateStep(
  questions: PreScreeningQuestion[],
  draft: Draft,
  today: string,
): QuestionErrors {
  const errors: QuestionErrors = {};
  for (const question of questions) {
    const message = validateQuestion(question, draft[question.code], today);
    if (message) errors[question.code] = message;
  }
  return errors;
}

/** Respostas das perguntas visíveis, no formato da API. */
export function buildAnswers(
  questions: PreScreeningQuestion[],
  draft: Draft,
): Record<string, AnswerValue> {
  const byCode = indexByCode(questions);
  const answers: Record<string, AnswerValue> = {};
  for (const question of sortQuestions(questions)) {
    if (!isVisible(question, draft, byCode)) continue;
    const value = toAnswer(question, draft[question.code]);
    if (value !== undefined) answers[question.code] = value;
  }
  return answers;
}

/** Erros por pergunta vindos da API ("answers.CODIGO" → CODIGO). */
export function answerErrorsFromApi(fieldErrors: Record<string, string>): QuestionErrors {
  const errors: QuestionErrors = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (field.startsWith('answers.')) errors[field.slice('answers.'.length)] = message;
  }
  return errors;
}

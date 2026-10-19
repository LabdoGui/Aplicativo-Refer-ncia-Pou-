import type {
  AnswerValue,
  PreScreeningQuestion,
  QuestionOption,
  ScreeningRuleView,
} from '@pulso/contracts';
import type { ScreeningQuestion, ScreeningRule } from '../../generated/prisma';
import type { EngineQuestion, EngineRule } from './rule-engine';

function options(value: unknown): QuestionOption[] | null {
  return Array.isArray(value) ? (value as QuestionOption[]) : null;
}

function answerValue(value: unknown): AnswerValue | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : null;
}

export function toEngineQuestion(question: ScreeningQuestion): EngineQuestion {
  return {
    id: question.id,
    code: question.code,
    step: question.step,
    order: question.order,
    text: question.text,
    type: question.type,
    options: options(question.options),
    required: question.required,
    showIfCode: question.showIfCode,
    showIfValue: answerValue(question.showIfValue),
  };
}

export function toEngineRule(rule: ScreeningRule): EngineRule {
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

export function toQuestionView(question: ScreeningQuestion): PreScreeningQuestion {
  const showIfValue = answerValue(question.showIfValue);
  return {
    id: question.id,
    code: question.code,
    step: question.step,
    order: question.order,
    text: question.text,
    helpText: question.helpText,
    type: question.type,
    options: options(question.options),
    required: question.required,
    showIf:
      question.showIfCode && (typeof showIfValue === 'string' || typeof showIfValue === 'boolean')
        ? { questionCode: question.showIfCode, equals: showIfValue }
        : null,
  };
}

export function toRuleView(
  rule: ScreeningRule & { question: Pick<ScreeningQuestion, 'code' | 'text'> },
): ScreeningRuleView {
  return {
    id: rule.id,
    questionCode: rule.question.code,
    questionText: rule.question.text,
    operator: rule.operator,
    value: answerValue(rule.value) ?? '',
    settingKey: rule.settingKey,
    severity: rule.severity,
    message: rule.message,
    validationStatus: rule.validationStatus,
    active: rule.active,
  };
}

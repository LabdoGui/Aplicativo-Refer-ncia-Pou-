/**
 * Administração do questionário, das regras e dos campos da triagem (espelho
 * de screening-config/*). Editar o questionário cria uma nova revisão (RN08).
 */
import {
  SCREENING_FIELD_TYPES,
  type AuthUser,
  type QuestionOption,
  type ScreeningConfigView,
  type ScreeningFieldType,
  type ScreeningFieldView,
  type ScreeningRuleView,
} from '@pulso/contracts';
import { sortQuestions } from '@backend/services/clinical/src/pre-screening/rule-engine';
import { recordAudit } from '../../core/audit';
import { fail, route, type AuthedRequest } from '../../core/http';
import { uuid } from '../../core/support';
import { sortFields, toFieldView } from './attendances';
import { toQuestionView, toRuleView } from './pre-screening';
import { clinical, SERVICE, type ClinicalField } from './state';
import {
  asBoolean,
  asNumber,
  asString,
  assertCanWrite,
  bodyOf,
  Checker,
  trim,
  UNPROCESSABLE_TITLE,
  uuidParam,
} from './validation';

/** Próxima revisão de uma versão: "2026.1-demo" → "2026.1-demo.r2" → "2026.1-demo.r3". */
export function nextRevision(version: string): string {
  const match = /^(.*)\.r(\d+)$/.exec(version);
  return match ? `${match[1]}.r${Number(match[2]) + 1}` : `${version}.r2`;
}

/**
 * RN08: editar o questionário ativo cria uma nova revisão da versão. Cada
 * pré-triagem guarda a versão com que foi avaliada.
 */
function bumpRevision(ruleSetId: string): string {
  const ruleSet = clinical().ruleSets.find((candidate) => candidate.id === ruleSetId);
  if (!ruleSet) fail(404, 'RULE_SET_NOT_FOUND', 'Nenhum conjunto de regras vigente.');
  ruleSet.version = nextRevision(ruleSet.version);
  return ruleSet.version;
}

/**
 * Campos declarados nos DTOs. O back-end registra `Object.keys(dto)` na
 * auditoria e, como a instância do DTO declara todos os campos (ES2022), a
 * lista traz sempre todos eles, informados ou não (igual à trilha real).
 */
const QUESTION_KEYS = ['text', 'helpText', 'active'];
const RULE_KEYS = ['message', 'active'];
const FIELD_KEYS = [
  'label',
  'unit',
  'options',
  'helpText',
  'required',
  'min',
  'max',
  'order',
  'active',
];

function view(): ScreeningConfigView {
  const state = clinical();
  const ruleSet = state.ruleSets.find((candidate) => candidate.status === 'ACTIVE');
  if (!ruleSet) fail(404, 'RULE_SET_NOT_FOUND', 'Nenhum conjunto de regras vigente.');
  const questions = state.questions.filter((question) => question.ruleSetId === ruleSet.id);
  const byId = new Map(questions.map((question) => [question.id, question]));
  const rules = state.rules
    .filter((rule) => rule.ruleSetId === ruleSet.id && byId.has(rule.questionId))
    .sort((a, b) => {
      const qa = byId.get(a.questionId)!;
      const qb = byId.get(b.questionId)!;
      return qa.step - qb.step || qa.order - qb.order || a.order - b.order;
    });
  return {
    ruleSet: {
      id: ruleSet.id,
      version: ruleSet.version,
      validationStatus: ruleSet.validationStatus,
      normativeReference: ruleSet.normativeReference,
      publishedAt: ruleSet.publishedAt,
    },
    questions: sortQuestions(questions).map((question) => ({
      ...toQuestionView(question),
      active: question.active,
    })),
    rules: rules.map((rule) => toRuleView(rule, byId.get(rule.questionId)!)),
  };
}

function updateQuestion(actor: AuthUser, id: string, input: unknown): ScreeningConfigView {
  const body = bodyOf(input);
  const check = new Checker(body, QUESTION_KEYS);
  const text = trim(asString(body.text));
  const helpText = trim(body.helpText);
  const active = asBoolean(body.active);
  if (text !== undefined && text !== null) check.string('text', text, { min: 5, max: 300 });
  if (helpText !== undefined && helpText !== null) check.string('helpText', helpText, { max: 500 });
  if (active !== undefined && active !== null) check.boolean('active', active);
  check.done();

  const question = clinical().questions.find((candidate) => candidate.id === id);
  if (!question) fail(404, 'QUESTION_NOT_FOUND', 'Pergunta não encontrada.');
  if (typeof text === 'string') question.text = text;
  if (helpText !== undefined) question.helpText = typeof helpText === 'string' && helpText ? helpText : null;
  if (typeof active === 'boolean') question.active = active;
  const version = bumpRevision(question.ruleSetId);
  recordAudit(SERVICE, {
    actor,
    action: 'screening_config.question_updated',
    entity: 'screening_question',
    entityId: id,
    metadata: { code: question.code, fields: QUESTION_KEYS, version },
  });
  return view();
}

function updateRule(actor: AuthUser, id: string, input: unknown): ScreeningRuleView {
  const body = bodyOf(input);
  const check = new Checker(body, RULE_KEYS);
  const message = trim(asString(body.message));
  const active = asBoolean(body.active);
  if (message !== undefined && message !== null) check.string('message', message, { min: 5, max: 500 });
  if (active !== undefined && active !== null) check.boolean('active', active);
  check.done();

  const state = clinical();
  const rule = state.rules.find((candidate) => candidate.id === id);
  if (!rule) fail(404, 'RULE_NOT_FOUND', 'Regra não encontrada.');
  if (typeof message === 'string') rule.message = message;
  if (typeof active === 'boolean') rule.active = active;
  const version = bumpRevision(rule.ruleSetId);
  recordAudit(SERVICE, {
    actor,
    action: 'screening_config.rule_updated',
    entity: 'screening_rule',
    entityId: id,
    metadata: { fields: RULE_KEYS, version },
  });
  const question = state.questions.find((candidate) => candidate.id === rule.questionId)!;
  return toRuleView(rule, question);
}

function fields(): ScreeningFieldView[] {
  return sortFields(clinical().fields).map(toFieldView);
}

interface FieldInput {
  label?: string;
  unit?: string | null;
  options?: QuestionOption[] | null;
  helpText?: string | null;
  required?: boolean;
  min?: number | null;
  max?: number | null;
  order?: number;
  active?: boolean;
}

/** Rótulo do campo (obrigatório na criação). */
function checkLabel(check: Checker, body: Record<string, unknown>, required: boolean) {
  const label = trim(asString(body.label));
  if (required || (label !== undefined && label !== null)) {
    check.string('label', label, { min: 2, max: 80 });
  }
  return typeof label === 'string' ? label : undefined;
}

/**
 * Validação de UpdateFieldDto (e da parte herdada de CreateFieldDto), na ordem
 * das propriedades do DTO. Na criação, o rótulo é validado antes, com o código.
 */
function checkFieldInput(
  check: Checker,
  body: Record<string, unknown>,
  withLabel: boolean,
): FieldInput {
  const dto: FieldInput = {};
  if (withLabel) dto.label = checkLabel(check, body, false);

  const unit = trim(body.unit);
  if (unit !== undefined && unit !== null) check.string('unit', unit, { max: 20 });
  if (unit !== undefined) dto.unit = typeof unit === 'string' ? unit : null;

  if (body.options !== undefined && body.options !== null) {
    if (!Array.isArray(body.options)) {
      check.add('options', 'Deve ser uma lista.');
    } else {
      if (body.options.length > 20) check.add('options', 'Informe no máximo 20 itens.');
      if (body.options.length < 1) check.add('options', 'Informe ao menos 1 itens.');
      const options: QuestionOption[] = [];
      body.options.forEach((raw: unknown, index: number) => {
        if (!raw || typeof raw !== 'object') {
          check.add(`options.${index}`, 'Deve ser um objeto válido.');
          return;
        }
        const option = raw as Record<string, unknown>;
        const optionCheck = new Checker(option, ['value', 'label']);
        const value = trim(asString(option.value));
        const optionLabel = trim(asString(option.label));
        optionCheck.string('value', value, { min: 1, max: 40 });
        optionCheck.string('label', optionLabel, { min: 1, max: 80 });
        for (const error of optionCheck.errors) {
          check.add(`options.${index}.${error.field}`, error.message);
        }
        options.push({ value: String(value), label: String(optionLabel) });
      });
      dto.options = options;
    }
  } else if (body.options === null) {
    dto.options = null;
  }

  const helpText = trim(body.helpText);
  if (helpText !== undefined && helpText !== null) check.string('helpText', helpText, { max: 300 });
  if (helpText !== undefined) dto.helpText = typeof helpText === 'string' ? helpText : null;

  const required = asBoolean(body.required);
  if (required !== undefined && required !== null) check.boolean('required', required);
  if (typeof required === 'boolean') dto.required = required;

  for (const key of ['min', 'max'] as const) {
    const value = body[key];
    if (value !== undefined && value !== null) check.number(key, value, {});
    if (value === null) dto[key] = null;
    else if (typeof value === 'number') dto[key] = value;
  }

  const order = asNumber(body.order);
  if (order !== undefined && order !== null) {
    check.number('order', order, { int: true, min: 0, max: 1000 });
  }
  if (typeof order === 'number') dto.order = order;

  const active = asBoolean(body.active);
  if (active !== undefined && active !== null) check.boolean('active', active);
  if (typeof active === 'boolean') dto.active = active;
  return dto;
}

function assertFieldShape(
  type: string,
  options: QuestionOption[] | null,
  min: number | null,
  max: number | null,
): void {
  if (type === 'SELECT' && (!options || options.length === 0)) {
    fail(422, 'FIELD_OPTIONS_REQUIRED', 'Campos de seleção precisam de opções.', UNPROCESSABLE_TITLE, [
      { field: 'options', message: 'Informe ao menos uma opção.' },
    ]);
  }
  if (options && new Set(options.map((o) => o.value)).size !== options.length) {
    fail(
      422,
      'FIELD_OPTIONS_DUPLICATED',
      'As opções precisam ter valores diferentes.',
      UNPROCESSABLE_TITLE,
    );
  }
  if (min !== null && max !== null && min > max) {
    fail(422, 'FIELD_RANGE_INVALID', 'O mínimo não pode ser maior que o máximo.', UNPROCESSABLE_TITLE, [
      { field: 'min', message: 'O mínimo não pode ser maior que o máximo.' },
    ]);
  }
}

const copyOptions = (options: QuestionOption[]) =>
  options.map((option) => ({ value: option.value, label: option.label }));

function createField(actor: AuthUser, input: unknown): ScreeningFieldView {
  const body = bodyOf(input);
  const check = new Checker(body, ['code', 'type', ...FIELD_KEYS]);
  const rawCode = asString(body.code);
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : rawCode;
  if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) {
    check.add(
      'code',
      'Use de 2 a 40 caracteres: letras maiúsculas, números e _ (começando por letra).',
    );
  }
  if (typeof code !== 'string') check.add('code', 'Deve ser um texto.');
  const label = checkLabel(check, body, true);
  const type = asString(body.type) as ScreeningFieldType;
  check.oneOf('type', type, SCREENING_FIELD_TYPES);
  const dto = { ...checkFieldInput(check, body, false), label };
  check.done();

  assertFieldShape(type, dto.options ?? null, dto.min ?? null, dto.max ?? null);
  const state = clinical();
  if (state.fields.some((field) => field.code === code)) {
    fail(409, 'FIELD_CODE_TAKEN', 'Já existe um campo com este código.', undefined, [
      { field: 'code', message: 'Já existe um campo com este código.' },
    ]);
  }
  const field: ClinicalField = {
    id: uuid(),
    code: code as string,
    label: dto.label!,
    type,
    unit: dto.unit ?? null,
    options: type === 'SELECT' && dto.options ? copyOptions(dto.options) : null,
    helpText: dto.helpText ?? null,
    required: dto.required ?? false,
    min: type === 'NUMBER' ? (dto.min ?? null) : null,
    max: type === 'NUMBER' ? (dto.max ?? null) : null,
    order: dto.order ?? 0,
    active: dto.active ?? true,
  };
  state.fields.push(field);
  recordAudit(SERVICE, {
    actor,
    action: 'screening_config.field_created',
    entity: 'screening_field',
    entityId: field.id,
    metadata: { code: field.code, type: field.type },
  });
  return toFieldView(field);
}

function updateField(actor: AuthUser, id: string, input: unknown): ScreeningFieldView {
  const body = bodyOf(input);
  const check = new Checker(body, FIELD_KEYS);
  const dto = checkFieldInput(check, body, true);
  check.done();

  const field = clinical().fields.find((candidate) => candidate.id === id);
  if (!field) fail(404, 'FIELD_NOT_FOUND', 'Campo não encontrado.');
  const options = dto.options !== undefined ? dto.options : field.options;
  const min = dto.min !== undefined ? dto.min : field.min;
  const max = dto.max !== undefined ? dto.max : field.max;
  assertFieldShape(field.type, options, min, max);
  if (dto.label !== undefined) field.label = dto.label;
  if (dto.unit !== undefined) field.unit = dto.unit || null;
  if (dto.options !== undefined && field.type === 'SELECT') {
    field.options = dto.options ? copyOptions(dto.options) : null;
  }
  if (dto.helpText !== undefined) field.helpText = dto.helpText || null;
  if (dto.required !== undefined) field.required = dto.required;
  if (field.type === 'NUMBER' && dto.min !== undefined) field.min = dto.min;
  if (field.type === 'NUMBER' && dto.max !== undefined) field.max = dto.max;
  if (dto.order !== undefined) field.order = dto.order;
  if (dto.active !== undefined) field.active = dto.active;
  recordAudit(SERVICE, {
    actor,
    action: 'screening_config.field_updated',
    entity: 'screening_field',
    entityId: id,
    metadata: { code: field.code, fields: FIELD_KEYS },
  });
  return toFieldView(field);
}

export function registerScreeningConfig(): void {
  const options = { permissions: ['settings:manage' as const] };
  const write =
    (handler: (actor: AuthUser, id: string, body: unknown) => unknown) =>
    (request: AuthedRequest) => {
      assertCanWrite(request.user);
      return handler(request.user, uuidParam(request.params.id), request.body);
    };
  route('GET', '/screening-config', () => view(), options);
  route('PATCH', '/screening-config/questions/:id', write(updateQuestion), options);
  route('PATCH', '/screening-config/rules/:id', write(updateRule), options);
  route('GET', '/screening-config/fields', () => fields(), options);
  route(
    'POST',
    '/screening-config/fields',
    (request) => {
      assertCanWrite(request.user);
      return createField(request.user, request.body);
    },
    options,
  );
  route('PATCH', '/screening-config/fields/:id', write(updateField), options);
}

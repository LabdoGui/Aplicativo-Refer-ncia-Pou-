/**
 * Validação dos DTOs do engagement-service, no formato do ValidationPipe global
 * do back-end (whitelist + forbidNonWhitelisted, mensagens em português):
 * 400 VALIDATION_ERROR com a lista de erros por campo.
 */
import { fail, type FieldIssue } from '../../core/http';

/** Uma regra do class-validator: devolve a mensagem quando o valor não passa. */
export type Rule = (value: unknown) => string | null;

export interface FieldSpec {
  /** @IsOptional(): null e undefined não são validados. */
  optional?: boolean;
  /** @Transform / @Type / conversão implícita, aplicada antes das regras. */
  transform?: (value: unknown) => unknown;
  /** @ValidateIf(): recebe o objeto já transformado; false pula todas as regras do campo. */
  when?: (dto: Record<string, unknown>) => boolean;
  /** Regras na ordem dos decoradores no DTO. */
  rules: Rule[];
}

export const isInt: Rule = (value) =>
  typeof value === 'number' && Number.isInteger(value) ? null : 'Deve ser um número inteiro.';
export const min =
  (limit: number): Rule =>
  (value) =>
    typeof value === 'number' && value >= limit ? null : `Deve ser maior ou igual a ${limit}.`;
export const max =
  (limit: number): Rule =>
  (value) =>
    typeof value === 'number' && value <= limit ? null : `Deve ser menor ou igual a ${limit}.`;
export const isIn =
  (values: readonly unknown[]): Rule =>
  (value) =>
    values.includes(value) ? null : 'Valor não permitido.';
export const isString: Rule = (value) => (typeof value === 'string' ? null : 'Deve ser um texto.');
export const maxLength =
  (limit: number): Rule =>
  (value) =>
    typeof value === 'string' && Array.from(value).length <= limit
      ? null
      : `Deve ter no máximo ${limit} caracteres.`;

export const minLength =
  (limit: number): Rule =>
  (value) =>
    typeof value === 'string' && Array.from(value).length >= limit
      ? null
      : `Deve ter ao menos ${limit} caracteres.`;
export const isBoolean: Rule = (value) =>
  typeof value === 'boolean' ? null : 'Deve ser verdadeiro ou falso.';
export const matches =
  (pattern: RegExp, message = 'Formato inválido.'): Rule =>
  (value) =>
    typeof value === 'string' && pattern.test(value) ? null : message;
/** Mensagem própria de uma regra (ex.: `@IsString({ message })`). */
export const withMessage =
  (rule: Rule, message: string): Rule =>
  (value) =>
    rule(value) ? message : null;

const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @IsUUID('4'). */
export const isUuidV4: Rule = (value) =>
  typeof value === 'string' && UUID_V4.test(value) ? null : 'Identificador inválido.';

/**
 * ParseUUIDPipe do Nest: um id fora do formato vira 400 genérico (a mensagem
 * técnica do framework não chega ao usuário).
 */
export function parseUuid(value: string): string {
  if (!UUID_ANY.test(value)) {
    fail(400, 'BAD_REQUEST', 'Verifique os dados informados e tente novamente.');
  }
  return value;
}

/** Conversão implícita (enableImplicitConversion) de um campo booleano. */
export const toBoolean = (value: unknown) =>
  value === undefined || value === null || typeof value === 'boolean' ? value : Boolean(value);
/** Conversão implícita (enableImplicitConversion) de um campo numérico. */
export const toNumber = (value: unknown) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;
/** @Type(() => Number) em parâmetros de query (sempre texto). */
export const queryNumber = (value: unknown) => (value === undefined ? undefined : Number(value));
export const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

/** Paginação comum (PaginationQueryDto). */
export const PAGINATION: Record<string, FieldSpec> = {
  page: { optional: true, transform: queryNumber, rules: [isInt, min(1)] },
  pageSize: { optional: true, transform: queryNumber, rules: [isInt, min(1), max(100)] },
};

export function validationFailed(errors: FieldIssue[]): never {
  return fail(
    400,
    'VALIDATION_ERROR',
    'Alguns campos precisam de correção.',
    'Dados inválidos',
    errors,
  );
}

/** Valida e transforma um objeto (corpo ou query) contra a especificação do DTO. */
export function validate<T>(input: Record<string, unknown>, spec: Record<string, FieldSpec>): T {
  const errors: FieldIssue[] = [];
  const seen = new Set<string>();
  const push = (field: string, message: string) => {
    const key = `${field}\u0000${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    errors.push({ field, message });
  };
  for (const key of Object.keys(input)) {
    if (!(key in spec)) push(key, 'Campo não permitido.');
  }
  const output: Record<string, unknown> = {};
  for (const [field, rule] of Object.entries(spec)) {
    const raw = input[field];
    if (raw !== undefined) output[field] = rule.transform ? rule.transform(raw) : raw;
  }
  for (const [field, rule] of Object.entries(spec)) {
    const value = output[field];
    if (rule.when && !rule.when(output)) continue;
    if (rule.optional && (value === undefined || value === null)) continue;
    // O class-validator aplica os decoradores de baixo para cima: os erros saem na ordem inversa.
    for (const check of [...rule.rules].reverse()) {
      const message = check(value);
      if (message) push(field, message);
    }
  }
  if (errors.length > 0) validationFailed(errors);
  return output as T;
}

/** Query string como objeto (o último valor de cada chave, como o Express com um valor só). */
export function queryObject(query: URLSearchParams): Record<string, unknown> {
  return Object.fromEntries(query.entries());
}

/** Corpo JSON como objeto (corpo que não é objeto vira vazio, como o body-parser). */
export function bodyObject(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

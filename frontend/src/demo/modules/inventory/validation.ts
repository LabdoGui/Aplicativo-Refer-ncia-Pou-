/**
 * Validação dos DTOs do inventory-service, no formato do ValidationPipe global
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

const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** @IsISO8601(): data/hora ISO 8601 (com `strict`, a data precisa existir no calendário). */
export const isIso8601 =
  (strict = false): Rule =>
  (value) => {
    const invalid = 'Informe uma data válida.';
    if (typeof value !== 'string' || !ISO_8601.test(value)) return invalid;
    if (Number.isNaN(Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value)))
      return invalid;
    if (strict) {
      const [, y, m, d] = ISO_DATE.exec(value.slice(0, 10)) ?? [];
      const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return invalid;
    }
    return null;
  };

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
    const value = rule.transform ? rule.transform(raw) : raw;
    if (raw !== undefined) output[field] = value;
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

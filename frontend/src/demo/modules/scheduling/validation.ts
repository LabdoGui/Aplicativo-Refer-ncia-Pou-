/**
 * Validação dos DTOs do scheduling-service (class-validator + ValidationPipe
 * global com whitelist/forbidNonWhitelisted), com as mesmas mensagens em
 * português e a mesma ordem dos erros por campo: campos não permitidos
 * primeiro, depois cada campo na ordem do DTO, com as regras na ordem em que o
 * class-validator as avalia (da última declarada para a primeira).
 */
import { fail, type FieldIssue } from '../../core/http';

export interface Check {
  message: string;
  test: (value: unknown) => boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

/** Data ISO 8601 válida no calendário (IsISO8601 com strict: true). */
function isIso8601(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = ISO_8601.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return false;
  if (date.getUTCDate() !== day) return false;
  if (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59)) return false;
  return !Number.isNaN(Date.parse(value));
}

export const is = {
  string: (): Check => ({ message: 'Deve ser um texto.', test: (v) => typeof v === 'string' }),
  minLength: (n: number): Check => ({
    message: `Deve ter ao menos ${n} caracteres.`,
    test: (v) => typeof v === 'string' && v.length >= n,
  }),
  maxLength: (n: number): Check => ({
    message: `Deve ter no máximo ${n} caracteres.`,
    test: (v) => typeof v === 'string' && v.length <= n,
  }),
  matches: (pattern: RegExp, message = 'Formato inválido.'): Check => ({
    message,
    test: (v) => typeof v === 'string' && pattern.test(v),
  }),
  uuid: (): Check => ({
    message: 'Identificador inválido.',
    test: (v) => typeof v === 'string' && UUID.test(v),
  }),
  iso8601: (): Check => ({ message: 'Informe uma data válida.', test: isIso8601 }),
  in: (values: readonly unknown[]): Check => ({
    message: 'Valor não permitido.',
    test: (v) => values.includes(v),
  }),
  int: (): Check => ({ message: 'Deve ser um número inteiro.', test: (v) => Number.isInteger(v) }),
  min: (n: number): Check => ({
    message: `Deve ser maior ou igual a ${n}.`,
    test: (v) => typeof v === 'number' && v >= n,
  }),
  max: (n: number): Check => ({
    message: `Deve ser menor ou igual a ${n}.`,
    test: (v) => typeof v === 'number' && v <= n,
  }),
  boolean: (): Check => ({
    message: 'Deve ser verdadeiro ou falso.',
    test: (v) => typeof v === 'boolean',
  }),
  array: (): Check => ({ message: 'Deve ser uma lista.', test: (v) => Array.isArray(v) }),
  arrayMaxSize: (n: number): Check => ({
    message: `Informe no máximo ${n} itens.`,
    test: (v) => Array.isArray(v) && v.length <= n,
  }),
  arrayUnique: (message = 'Não repita itens na lista.'): Check => ({
    message,
    test: (v) => Array.isArray(v) && new Set(v).size === v.length,
  }),
  /** Regra aplicada a cada item da lista ({ each: true }). */
  each: (check: Check): Check => ({
    message: check.message,
    test: (v) => Array.isArray(v) && v.every((item) => check.test(item)),
  }),
};

/** @Transform(trim) dos DTOs. */
export const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

export interface FieldOptions {
  /** @IsOptional(): ausente (undefined/null) não é validado. */
  optional?: boolean;
  /** @ValidateIf((_, value) => value !== null): null é aceito. */
  nullable?: boolean;
  /**
   * Tipo declarado no DTO (enableImplicitConversion): o valor é convertido com
   * String/Number/Boolean antes da validação. Campos anuláveis (`string | null`)
   * não têm tipo para a conversão e ficam como vieram.
   */
  type?: 'string' | 'number' | 'boolean';
  /** @Transform(...), aplicado depois da conversão de tipo. */
  transform?: (value: unknown) => unknown;
}

const CONVERT = { string: String, number: Number, boolean: Boolean } as const;

type Source = Record<string, unknown>;

export class Validator {
  readonly issues: FieldIssue[] = [];
  /** Valores já transformados (só os campos presentes, como o class-transformer). */
  readonly output: Source = {};
  private readonly source: Source;
  private readonly prefix: string;

  constructor(source: unknown, allowed: readonly string[], prefix = '') {
    this.source =
      source && typeof source === 'object' && !Array.isArray(source) ? (source as Source) : {};
    this.prefix = prefix;
    for (const key of Object.keys(this.source)) {
      if (!allowed.includes(key)) {
        this.issues.push({ field: this.path(key), message: 'Campo não permitido.' });
      }
    }
  }

  private path(field: string): string {
    return this.prefix ? `${this.prefix}.${field}` : field;
  }

  /** Valida um campo com as regras na ordem em que aparecem no DTO. */
  field(name: string, checks: Check[], options: FieldOptions = {}): unknown {
    const present = Object.prototype.hasOwnProperty.call(this.source, name);
    const raw = this.source[name];
    const converted =
      options.type && raw !== undefined && raw !== null ? CONVERT[options.type](raw) : raw;
    const value = options.transform ? options.transform(converted) : converted;
    if (present) this.output[name] = value;
    if (options.optional && (value === undefined || value === null)) return value;
    if (options.nullable && value === null) return value;
    const failed = checks.filter((check) => !check.test(value)).reverse();
    for (const check of failed)
      this.issues.push({ field: this.path(name), message: check.message });
    return value;
  }

  /** Junta os erros de um objeto aninhado (@ValidateNested). */
  merge(other: Validator): void {
    this.issues.push(...other.issues);
  }

  /** Lança 400 VALIDATION_ERROR (mesma resposta do ValidationPipe global) se houver erros. */
  done(): void {
    if (this.issues.length > 0) {
      fail(400, 'VALIDATION_ERROR', 'Alguns campos precisam de correção.', 'Dados inválidos', [
        ...this.issues,
      ]);
    }
  }
}

/** Query string como objeto (primeiro valor de cada chave), para validar como um DTO. */
export function queryObject(query: URLSearchParams): Source {
  const result: Source = {};
  for (const key of query.keys()) {
    if (!(key in result)) result[key] = query.get(key);
  }
  return result;
}

/** @Type(() => Number) / enableImplicitConversion dos parâmetros numéricos de query. */
export const toNumber = (value: unknown) =>
  value === undefined || value === null || value === '' ? value : Number(value);

/** ParseUUIDPipe: identificador da rota inválido → 400 genérico. */
export function parseUuid(value: string): string {
  if (!UUID.test(value)) {
    fail(400, 'BAD_REQUEST', 'Verifique os dados informados e tente novamente.');
  }
  return value;
}

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_ONLY_MESSAGE = 'Informe a data no formato AAAA-MM-DD.';

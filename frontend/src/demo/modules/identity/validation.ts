/**
 * Validação dos DTOs do identity (equivalente ao ValidationPipe global com
 * class-validator): remove espaços como os @Transform, recusa campos
 * desconhecidos e devolve 400 VALIDATION_ERROR com as mensagens por campo.
 */
import { PASSWORD_POLICY } from '@pulso/contracts';
import { fail, type FieldIssue } from '../../core/http';

/** Nome com letras (inclusive acentuadas), espaços, apóstrofo e hífen. */
export const PERSON_NAME = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
/** Telefone brasileiro: (11) 91234-5678, 11912345678, +55 11 91234-5678… */
export const PHONE = /^\+?[\d\s().-]{10,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NAME_MESSAGE = 'Use apenas letras, espaços, apóstrofo e hífen.';
export const PHONE_MESSAGE = 'Informe um telefone válido com DDD.';

export const isUuid = (value: string, version4 = false) =>
  (version4 ? UUID_V4 : UUID_ANY).test(value);

/** Mesmo corpo do BadRequestException do createValidationPipe. */
export function validationFail(errors: FieldIssue[]): never {
  return fail(
    400,
    'VALIDATION_ERROR',
    'Alguns campos precisam de correção.',
    'Dados inválidos',
    errors,
  );
}

export const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : value);
export const normalizedEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Coleta os erros por campo (sem repetir a mesma mensagem no mesmo campo). */
export class Issues {
  readonly list: FieldIssue[] = [];

  add(field: string, message: string): void {
    if (!this.list.some((issue) => issue.field === field && issue.message === message)) {
      this.list.push({ field, message });
    }
  }

  /** whitelist + forbidNonWhitelisted: campos fora do DTO são recusados. */
  unknown(source: Record<string, unknown> | URLSearchParams, allowed: readonly string[]): void {
    const keys = source instanceof URLSearchParams ? [...source.keys()] : Object.keys(source);
    for (const key of keys) if (!allowed.includes(key)) this.add(key, 'Campo não permitido.');
  }

  /**
   * Texto com @IsString, @MinLength, @MaxLength e @Matches (as mensagens saem na
   * mesma ordem do class-validator: padrão, máximo, mínimo, tipo).
   */
  text(
    field: string,
    value: unknown,
    rule: {
      min?: number;
      max?: number;
      pattern?: RegExp;
      patternMessage?: string;
      minMessage?: string;
    },
  ): void {
    const isText = typeof value === 'string';
    if (rule.pattern && (!isText || !rule.pattern.test(value))) {
      this.add(field, rule.patternMessage ?? 'Formato inválido.');
    }
    if (rule.max !== undefined && (!isText || value.length > rule.max)) {
      this.add(field, `Deve ter no máximo ${rule.max} caracteres.`);
    }
    if (rule.min !== undefined && (!isText || value.length < rule.min)) {
      this.add(field, rule.minMessage ?? `Deve ter ao menos ${rule.min} caracteres.`);
    }
    if (!isText) this.add(field, 'Deve ser um texto.');
  }

  email(field: string, value: unknown): void {
    if (typeof value !== 'string' || value.length > 160) {
      this.add(field, 'Deve ter no máximo 160 caracteres.');
    }
    if (typeof value !== 'string' || !EMAIL.test(value))
      this.add(field, 'Informe um e-mail válido.');
  }

  /** Nova senha pela política (PASSWORD_POLICY). */
  password(field: string, value: unknown): void {
    this.text(field, value, {
      min: PASSWORD_POLICY.minLength,
      max: PASSWORD_POLICY.maxLength,
      pattern: PASSWORD_POLICY.pattern,
      patternMessage: PASSWORD_POLICY.message,
      minMessage: PASSWORD_POLICY.message,
    });
  }

  /** Senha a conferir (só @IsString, @MinLength(1) e @MaxLength). */
  passwordToCheck(field: string, value: unknown): void {
    this.text(field, value, { min: 1, max: PASSWORD_POLICY.maxLength });
  }

  boolean(field: string, value: unknown): void {
    if (typeof value !== 'boolean') this.add(field, 'Deve ser verdadeiro ou falso.');
  }

  oneOf(field: string, value: unknown, options: readonly string[]): void {
    if (typeof value !== 'string' || !options.includes(value))
      this.add(field, 'Valor não permitido.');
  }

  /** Lista de UUIDs v4 (@IsArray, @ArrayMaxSize, @IsUUID('4', { each: true })). */
  uuidList(field: string, value: unknown, maxSize: number): void {
    if (!Array.isArray(value)) {
      this.add(field, 'Identificador inválido.');
      this.add(field, `Informe no máximo ${maxSize} itens.`);
      this.add(field, 'Deve ser uma lista.');
      return;
    }
    if (value.some((item) => typeof item !== 'string' || !isUuid(item, true))) {
      this.add(field, 'Identificador inválido.');
    }
    if (value.length > maxSize) this.add(field, `Informe no máximo ${maxSize} itens.`);
  }

  /** Inteiro da query (@Type(() => Number), @IsInt, @Min, @Max). */
  integer(field: string, raw: string | null, min: number, max?: number): number | undefined {
    if (raw === null) return undefined;
    const value = Number(raw);
    if (max !== undefined && !(value <= max)) this.add(field, `Deve ser menor ou igual a ${max}.`);
    if (!(value >= min)) this.add(field, `Deve ser maior ou igual a ${min}.`);
    if (!Number.isInteger(value)) this.add(field, 'Deve ser um número inteiro.');
    return value;
  }

  /** Lança 400 se algum campo foi recusado. */
  check(): void {
    if (this.list.length > 0) validationFail(this.list);
  }
}

/** Data AAAA-MM-DD existente no calendário (@IsISO8601({ strict: true })). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Corpo JSON como objeto (corpo ausente ou não-objeto vira {}). */
export function bodyOf(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/**
 * Validações de entrada equivalentes ao ValidationPipe global (whitelist +
 * forbidNonWhitelisted, mensagens em português) e ao ParseUUIDPipe, só no que
 * a interface pode disparar.
 */
import type { AuthUser } from '@pulso/contracts';
import { fail, type FieldIssue } from '../../core/http';
import { clinical } from './state';

const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Título do 422 no back-end (DEFAULTS do ProblemDetailsFilter). */
export const UNPROCESSABLE_TITLE = 'Operação não permitida';

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_ANY.test(value);
export const isUuidV4 = (value: unknown): value is string =>
  typeof value === 'string' && UUID_V4.test(value);

/** ParseUUIDPipe: parâmetro de rota que não é UUID vira 400 genérico (mensagem do Nest oculta). */
export function uuidParam(value: string): string {
  if (!isUuid(value)) {
    fail(400, 'BAD_REQUEST', 'Verifique os dados informados e tente novamente.', 'Requisição inválida');
  }
  return value;
}

/**
 * enableImplicitConversion do ValidationPipe: o class-transformer converte o
 * valor pelo tipo declarado na propriedade do DTO (boolean, number ou string)
 * antes de validar; null e undefined ficam como estão. Propriedades com tipo
 * união (ex.: string | null) não são convertidas.
 */
export const asBoolean = (value: unknown): unknown =>
  value === undefined || value === null ? value : Boolean(value);
export const asNumber = (value: unknown): unknown =>
  value === undefined || value === null ? value : Number(value);
export const asString = (value: unknown): unknown =>
  value === undefined || value === null ? value : String(value);

/** @Transform(trim) dos DTOs. */
export const trim = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value);

/** Acumula erros por campo e falha como o exceptionFactory do ValidationPipe. */
export class Checker {
  readonly errors: FieldIssue[] = [];

  /** `allowed`: propriedades declaradas no DTO; as demais são recusadas (forbidNonWhitelisted). */
  constructor(input: unknown, allowed: readonly string[]) {
    if (input && typeof input === 'object') {
      for (const key of Object.keys(input)) {
        if (!allowed.includes(key)) this.add(key, 'Campo não permitido.');
      }
    }
  }

  add(field: string, message: string): void {
    if (!this.errors.some((error) => error.field === field && error.message === message)) {
      this.errors.push({ field, message });
    }
  }

  /**
   * @IsInt/@IsNumber + @Min/@Max. Como no class-validator, todas as regras que
   * falham entram, na ordem inversa dos decoradores (@Max, @Min, @IsInt).
   */
  number(field: string, value: unknown, rule: { int?: boolean; min?: number; max?: number }) {
    const isNumber = typeof value === 'number' && Number.isFinite(value);
    if (rule.max !== undefined && !(isNumber && value <= rule.max)) {
      this.add(field, `Deve ser menor ou igual a ${rule.max}.`);
    }
    if (rule.min !== undefined && !(isNumber && value >= rule.min)) {
      this.add(field, `Deve ser maior ou igual a ${rule.min}.`);
    }
    if (rule.int ? !(isNumber && Number.isInteger(value)) : !isNumber) {
      this.add(field, rule.int ? 'Deve ser um número inteiro.' : 'Deve ser um número.');
    }
  }

  /** @IsString + @MinLength/@MaxLength (mesma ordem inversa). */
  string(field: string, value: unknown, rule: { min?: number; max?: number } = {}) {
    const isString = typeof value === 'string';
    if (rule.max !== undefined && !(isString && value.length <= rule.max)) {
      this.add(field, `Deve ter no máximo ${rule.max} caracteres.`);
    }
    if (rule.min !== undefined && !(isString && value.length >= rule.min)) {
      this.add(field, `Deve ter ao menos ${rule.min} caracteres.`);
    }
    if (!isString) this.add(field, 'Deve ser um texto.');
  }

  boolean(field: string, value: unknown) {
    if (typeof value !== 'boolean') this.add(field, 'Deve ser verdadeiro ou falso.');
  }

  uuidV4(field: string, value: unknown) {
    if (!isUuidV4(value)) this.add(field, 'Identificador inválido.');
  }

  oneOf(field: string, value: unknown, allowed: readonly string[]) {
    if (typeof value !== 'string' || !allowed.includes(value)) this.add(field, 'Valor não permitido.');
  }

  object(field: string, value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      this.add(field, 'Deve ser um objeto.');
    }
  }

  done(): void {
    if (this.errors.length > 0) {
      fail(400, 'VALIDATION_ERROR', 'Alguns campos precisam de correção.', 'Dados inválidos', [
        ...this.errors,
      ]);
    }
  }
}

/** Corpo como objeto (o handler recebe `{}` quando não há corpo). */
export function bodyOf(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/**
 * AuthGuard + DeletedAccountsModule: conta excluída com token ainda válido não
 * grava mais nada no serviço.
 */
export function assertCanWrite(user: AuthUser): void {
  if (clinical().deletedUsers.includes(user.id)) {
    fail(401, 'SESSION_EXPIRED', 'Sua sessão foi encerrada. Entre novamente.', 'Autenticação necessária');
  }
}

import type { Role } from './roles';

/** Corpo de erro padrão da API (RFC 9457 – Problem Details). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  requestId?: string;
  errors?: Array<{ field: string; message: string }>;
}

/** Usuário autenticado, como extraído do JWT. */
export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  unitIds: string[];
  /** Sessão (família de refresh tokens) que emitiu o token. */
  sessionId?: string;
}

/** Claims do access token emitido pelo identity-service. */
export interface AccessTokenClaims {
  sub: string;
  role: Role;
  name: string;
  unitIds?: string[];
  /** Id da sessão: permite encerrar as outras sessões sem derrubar a atual. */
  sid?: string;
}

export const JWT_ISSUER = 'pulso-identity';
export const JWT_AUDIENCE = 'pulso';

/** Cabeçalhos HTTP usados entre componentes. */
export const HEADERS = {
  requestId: 'x-request-id',
  internalToken: 'x-internal-token',
} as const;

/**
 * Formato aceito para o x-request-id vindo do cliente. O nginx usa a mesma
 * expressão (docker/nginx.conf): mantenha as duas iguais.
 */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/** Indica se o valor pode ser reaproveitado como id da requisição. */
export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

export interface HealthCheckResult {
  status: 'up' | 'down';
  service: string;
  version: string;
  uptimeSeconds: number;
  checks: Record<string, 'up' | 'down'>;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

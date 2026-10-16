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
}

/** Claims do access token emitido pelo identity-service. */
export interface AccessTokenClaims {
  sub: string;
  role: Role;
  name: string;
  unitIds?: string[];
}

export const JWT_ISSUER = 'pulso-identity';
export const JWT_AUDIENCE = 'pulso';

/** Cabeçalhos HTTP usados entre componentes. */
export const HEADERS = {
  requestId: 'x-request-id',
  internalToken: 'x-internal-token',
} as const;

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

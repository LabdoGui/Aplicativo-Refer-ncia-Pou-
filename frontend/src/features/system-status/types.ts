/** Contrato de GET /api/v1/health/services (gateway). */
export type HealthStatus = 'up' | 'degraded' | 'down';
export type CheckStatus = 'up' | 'down';

export interface ServiceHealth {
  name: string;
  title?: string;
  status: HealthStatus;
  /** Pode faltar quando o serviço não respondeu. */
  version?: string | null;
  checks: Record<string, CheckStatus>;
  latencyMs?: number | null;
}

export interface ServicesHealth {
  status: HealthStatus;
  checkedAt: string;
  services: ServiceHealth[];
}

export function isServicesHealth(value: unknown): value is ServicesHealth {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ServicesHealth).status === 'string' &&
    Array.isArray((value as ServicesHealth).services)
  );
}

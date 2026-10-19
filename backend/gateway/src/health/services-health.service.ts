import { Inject, Injectable, Logger } from '@nestjs/common';
import { fetchJson } from '../upstreams/fetch-json';
import { UPSTREAMS, type Upstream } from '../upstreams/upstreams';
import type {
  ComponentStatus,
  OverallStatus,
  ServiceHealthDto,
  ServicesHealthDto,
} from './services-health.dto';

/** Tempo máximo de espera pelo health check de cada serviço. */
export const SERVICE_HEALTH_TIMEOUT_MS = 2_000;

function isStatus(value: unknown): value is ComponentStatus {
  return value === 'up' || value === 'down';
}

/** Mantém só pares `nome → up|down` do corpo recebido (nada além disso é repassado). */
function sanitizeChecks(value: unknown): Record<string, ComponentStatus> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, ComponentStatus] => isStatus(entry[1])),
  );
}

export function overallStatus(services: Array<{ status: ComponentStatus }>): OverallStatus {
  const up = services.filter((service) => service.status === 'up').length;
  if (up === services.length) return 'up';
  return up === 0 ? 'down' : 'degraded';
}

/** Consulta o GET /health de todos os serviços em paralelo. */
@Injectable()
export class ServicesHealthService {
  private readonly logger = new Logger(ServicesHealthService.name);

  constructor(@Inject(UPSTREAMS) private readonly upstreams: Upstream[]) {}

  async check(requestId?: string): Promise<ServicesHealthDto> {
    const services = await Promise.all(
      this.upstreams.map((upstream) => this.checkOne(upstream, requestId)),
    );
    return { status: overallStatus(services), checkedAt: new Date().toISOString(), services };
  }

  private async checkOne(upstream: Upstream, requestId?: string): Promise<ServiceHealthDto> {
    const base = { name: upstream.name, title: upstream.title };
    try {
      const result = await fetchJson(`${upstream.url}/health`, {
        timeoutMs: SERVICE_HEALTH_TIMEOUT_MS,
        requestId,
      });
      const body = (result.body ?? {}) as { status?: unknown; version?: unknown; checks?: unknown };
      return {
        ...base,
        status: result.ok && body.status === 'up' ? 'up' : 'down',
        version: typeof body.version === 'string' ? body.version : null,
        checks: sanitizeChecks(body.checks),
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      this.logger.debug(
        { err: error, service: upstream.name },
        'Serviço sem resposta no health check',
      );
      return { ...base, status: 'down', version: null, checks: {}, latencyMs: null };
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { AppException, InternalHttpClient } from '@pulso/common';
import { API_PREFIX, type ServiceName } from '@pulso/contracts';
import { UPSTREAMS, type Upstream } from '../upstreams/upstreams';

/** Tempo máximo de espera por um serviço numa composição (o painel não fica preso a um lento). */
export const COMPOSITION_TIMEOUT_MS = 3_000;

export const STATS_PATH = `/${API_PREFIX}/internal/stats`;
export const AUDIT_LOGS_PATH = `/${API_PREFIX}/internal/audit-logs`;

export type Query = Record<string, string | number | undefined>;

/** Resultado da consulta a um serviço: o dado ou o motivo da falha (para o log). */
export type SourceResult<T> =
  | { service: ServiceName; ok: true; value: T }
  | { service: ServiceName; ok: false; reason: string };

/**
 * Consulta rotas /internal dos serviços para as composições do gateway. Nunca
 * lança: cada falha (serviço fora do ar, rota inexistente, resposta inválida)
 * vira um resultado `ok: false`, e quem chama decide como degradar.
 */
@Injectable()
export class InternalSources {
  private readonly urls: Map<ServiceName, string>;

  constructor(
    private readonly http: InternalHttpClient,
    @Inject(UPSTREAMS) upstreams: Upstream[],
  ) {
    this.urls = new Map(upstreams.map((upstream) => [upstream.name, upstream.url]));
  }

  async get<T>(
    service: ServiceName,
    path: string,
    query: Query,
    isValid: (body: unknown) => body is T,
    requestId?: string,
  ): Promise<SourceResult<T>> {
    const baseUrl = this.urls.get(service);
    if (!baseUrl) return { service, ok: false, reason: 'NOT_CONFIGURED' };
    try {
      const body = await this.http.get<unknown>(baseUrl, path, {
        query,
        requestId,
        timeoutMs: COMPOSITION_TIMEOUT_MS,
      });
      return isValid(body)
        ? { service, ok: true, value: body }
        : { service, ok: false, reason: 'INVALID_RESPONSE' };
    } catch (error) {
      return {
        service,
        ok: false,
        reason: error instanceof AppException ? error.code : 'UNEXPECTED_ERROR',
      };
    }
  }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

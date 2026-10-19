import { Inject, Injectable, Logger } from '@nestjs/common';
import { HEADERS } from '@pulso/contracts';
import { AppException } from '../errors/app.exception';
import { APP_CONFIG } from '../tokens';
import type { BaseEnv } from '../config/env';

export interface InternalRequestOptions {
  requestId?: string;
  timeoutMs?: number;
  query?: Record<string, string | number | undefined>;
}

/**
 * Cliente HTTP para rotas /internal de outros serviços: token de serviço,
 * propagação do x-request-id e timeout curto (falha rápido em vez de travar).
 */
@Injectable()
export class InternalHttpClient {
  private readonly logger = new Logger(InternalHttpClient.name);

  constructor(@Inject(APP_CONFIG) private readonly config: BaseEnv) {}

  async get<T>(baseUrl: string, path: string, options: InternalRequestOptions = {}): Promise<T> {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = {
      accept: 'application/json',
      [HEADERS.internalToken]: this.config.INTERNAL_API_TOKEN,
    };
    if (options.requestId) headers[HEADERS.requestId] = options.requestId;

    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
      });
    } catch (error) {
      // Serviço fora do ar ou lento é uma situação prevista (degradação parcial): aviso sem stack.
      this.logger.warn(
        { url: url.toString(), reason: error instanceof Error ? error.message : String(error) },
        'Falha na chamada interna',
      );
      throw new AppException(
        503,
        'UPSTREAM_UNAVAILABLE',
        'Um serviço necessário está temporariamente indisponível. Tente novamente em instantes.',
      );
    }

    if (response.status === 404) {
      throw new AppException(404, 'NOT_FOUND', 'O recurso solicitado não foi encontrado.');
    }
    if (!response.ok) {
      this.logger.warn(
        { url: url.toString(), status: response.status },
        'Chamada interna retornou erro',
      );
      throw new AppException(
        503,
        'UPSTREAM_ERROR',
        'Um serviço necessário respondeu com erro. Tente novamente em instantes.',
      );
    }
    return (await response.json()) as T;
  }
}

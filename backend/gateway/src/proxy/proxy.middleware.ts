import type { ClientRequest } from 'node:http';
import type { Socket } from 'node:net';
import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware, type RequestHandler } from 'http-proxy-middleware';
import { AppException } from '@pulso/common';
import { HEADERS, type ServiceName } from '@pulso/contracts';
import { ensureRequestId } from '../http/request-id';
import { pathnameOf } from '../http/request-path';
import { UPSTREAMS, type Upstream } from '../upstreams/upstreams';
import { resolveRoute } from './route-resolver';

/** Tempo máximo de espera pela resposta de um serviço. */
export const PROXY_TIMEOUT_MS = 15_000;

function isResponse(target: Response | Socket): target is Response {
  return typeof (target as Response).writeHead === 'function';
}

/**
 * Proxy reverso por prefixo de rota. Montado na raiz (como middleware do Nest,
 * depois do log/request-id), resolve o destino com `resolveRoute` e repassa o
 * caminho original sem alteração; o corpo é transmitido intacto (bodyParser
 * desligado no gateway).
 */
@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Proxy');
  private readonly proxies: Map<ServiceName, RequestHandler<Request, Response>>;
  /** `next` de cada requisição em trânsito: erros do proxy seguem para o filtro de Problem Details. */
  private readonly pendingNext = new WeakMap<Request, NextFunction>();
  private readonly timedOut = new WeakSet<Request>();

  constructor(@Inject(UPSTREAMS) upstreams: Upstream[]) {
    this.proxies = new Map(
      upstreams.map((upstream) => [upstream.name, this.createProxy(upstream)]),
    );
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const route = resolveRoute(pathnameOf(request.originalUrl));
    switch (route.kind) {
      case 'local':
        return next();
      case 'blocked':
        throw new AppException(404, 'NOT_FOUND', 'O recurso solicitado não foi encontrado.');
      case 'invalid':
        throw new AppException(400, 'INVALID_PATH', 'O endereço solicitado é inválido.');
      case 'proxy': {
        // Cabeçalhos ajustados antes de criar a requisição ao serviço.
        request.headers[HEADERS.requestId] = ensureRequestId(request, response);
        delete request.headers[HEADERS.internalToken];
        this.pendingNext.set(request, next);
        void this.proxies.get(route.service)!(request, response, next);
      }
    }
  }

  private createProxy(upstream: Upstream): RequestHandler<Request, Response> {
    return createProxyMiddleware<Request, Response>({
      target: upstream.url,
      changeOrigin: true,
      xfwd: true,
      proxyTimeout: PROXY_TIMEOUT_MS,
      // Caminho e query exatamente como chegaram (independe de onde o middleware foi montado).
      pathRewrite: (_path, request) => request.originalUrl,
      on: {
        proxyReq: (proxyRequest: ClientRequest, request: Request) => {
          proxyRequest.once('timeout', () => this.timedOut.add(request));
        },
        error: (error, request, response) =>
          this.handleError(upstream.name, error, request, response),
      },
    });
  }

  private handleError(
    service: ServiceName,
    error: Error,
    request: Request,
    response: Response | Socket,
  ): void {
    const timedOut = this.timedOut.has(request);
    this.logger.error(
      {
        err: error,
        service,
        requestId: (request as Request & { id?: unknown }).id,
        method: request.method,
        path: pathnameOf(request.originalUrl),
        timedOut,
      },
      timedOut
        ? `Serviço ${service} não respondeu a tempo`
        : `Falha ao contatar o serviço ${service}`,
    );

    const next = this.pendingNext.get(request);
    if (!isResponse(response) || response.headersSent || !next) {
      // Resposta já iniciada (ou conexão sem HTTP): só resta encerrar.
      response.destroy();
      return;
    }
    next(
      timedOut
        ? new AppException(
            504,
            'UPSTREAM_TIMEOUT',
            'O serviço demorou demais para responder. Tente novamente em instantes.',
            'Tempo de resposta esgotado',
          )
        : new AppException(
            503,
            'UPSTREAM_UNAVAILABLE',
            'O serviço está temporariamente indisponível. Tente novamente em instantes.',
            'Serviço indisponível',
          ),
    );
  }
}

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RequestMethod } from '@nestjs/common';
import type { Params } from 'nestjs-pino';
import { HEADERS } from '@pulso/contracts';

/**
 * Logs estruturados em JSON com `requestId` e nome do serviço.
 * Cabeçalhos sensíveis (Authorization, Cookie, token interno) nunca são registrados.
 */
export function buildLoggerParams(serviceName: string, level: string, pretty: boolean): Params {
  return {
    // Sintaxe de rotas do Express 5 / path-to-regexp v8.
    forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    pinoHttp: {
      level,
      base: { service: serviceName },
      genReqId: (request: IncomingMessage, response: ServerResponse) => {
        const incoming = request.headers[HEADERS.requestId];
        const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        response.setHeader(HEADERS.requestId, id);
        return id;
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          `req.headers["${HEADERS.internalToken}"]`,
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
      serializers: {
        req: (request: { id: string; method: string; url: string }) => ({
          id: request.id,
          method: request.method,
          url: request.url,
        }),
        res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
      },
      autoLogging: {
        ignore: (request: IncomingMessage) => request.url === '/health',
      },
      customLogLevel: (_request: IncomingMessage, response: ServerResponse, error?: Error) => {
        if (error || response.statusCode >= 500) return 'error';
        if (response.statusCode >= 400) return 'warn';
        return 'info';
      },
      ...(pretty
        ? { transport: { target: 'pino-pretty', options: { singleLine: true, colorize: true } } }
        : {}),
    },
  };
}

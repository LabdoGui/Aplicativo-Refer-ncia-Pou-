import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { HEADERS, isValidRequestId } from '@pulso/contracts';

/**
 * Id da requisição. Normalmente já foi definido pelo pino-http (CoreModule),
 * que reaproveita o x-request-id do cliente (se tiver o formato aceito,
 * REQUEST_ID_PATTERN) ou gera um UUID e o devolve no cabeçalho da resposta.
 * O fallback mantém a mesma regra mesmo sem o logger.
 */
export function ensureRequestId(request: Request, response: Response): string {
  const fromLogger = (request as Request & { id?: unknown }).id;
  if (isValidRequestId(fromLogger)) return fromLogger;

  const incoming = request.headers[HEADERS.requestId];
  const id = isValidRequestId(incoming) ? incoming : randomUUID();
  (request as Request & { id?: unknown }).id = id;
  if (!response.headersSent) response.setHeader(HEADERS.requestId, id);
  return id;
}

import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { HEADERS } from '@pulso/contracts';

/**
 * Id da requisição. Normalmente já foi definido pelo pino-http (CoreModule),
 * que reaproveita o x-request-id do cliente ou gera um UUID e o devolve no
 * cabeçalho da resposta. O fallback mantém a garantia mesmo sem o logger.
 */
export function ensureRequestId(request: Request, response: Response): string {
  const fromLogger = (request as Request & { id?: unknown }).id;
  if (typeof fromLogger === 'string' && fromLogger.length > 0) return fromLogger;

  const id = randomUUID();
  (request as Request & { id?: unknown }).id = id;
  if (!response.headersSent) response.setHeader(HEADERS.requestId, id);
  return id;
}

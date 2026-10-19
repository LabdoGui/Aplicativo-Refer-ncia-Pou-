import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppException } from '@pulso/common';
import { pathnameOf } from '../http/request-path';
import { classifyRateLimit } from './rate-limiter';
import { RateLimitService } from './rate-limit.service';

function waitText(seconds: number): string {
  return seconds === 1 ? '1 segundo' : `${seconds} segundos`;
}

/**
 * Limite de requisições por IP (o Express já resolve o IP real atrás do nginx
 * via `trust proxy`). Rotas de login, cadastro e refresh têm limite próprio.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly rateLimit: RateLimitService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const bucket = classifyRateLimit(request.method, pathnameOf(request.originalUrl));
    if (bucket === 'exempt') return next();

    const clientKey = request.ip ?? request.socket.remoteAddress ?? 'desconhecido';
    const decision = this.rateLimit.hit(bucket, clientKey);
    response.setHeader('RateLimit-Limit', decision.limit);
    response.setHeader('RateLimit-Remaining', decision.remaining);
    response.setHeader('RateLimit-Reset', decision.resetSeconds);

    if (!decision.allowed) {
      response.setHeader('Retry-After', decision.resetSeconds);
      throw new AppException(
        429,
        'TOO_MANY_REQUESTS',
        `Você fez muitas tentativas em pouco tempo. Aguarde ${waitText(decision.resetSeconds)} e tente novamente.`,
        'Muitas tentativas',
      );
    }
    next();
  }
}

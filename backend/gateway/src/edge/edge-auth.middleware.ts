import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppException, TOKEN_VERIFIER, type TokenVerifier } from '@pulso/common';
import { pathnameOf } from '../http/request-path';
import { resolveRoute } from '../proxy/route-resolver';

/**
 * Prefixos sem validação de borda: autenticação (o frontend pode mandar um
 * token vencido ao renovar a sessão) e chaves públicas (JWKS).
 */
const SKIP_PREFIXES = new Set(['auth', '.well-known']);

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}

/**
 * Primeira barreira de autenticação: se uma requisição para um serviço traz
 * um Bearer token, ele precisa ser válido (assinatura via JWKS do identity).
 * Requisições sem token seguem: cada serviço decide o que é público. Os
 * serviços sempre revalidam o token, papel e escopo.
 */
@Injectable()
export class EdgeAuthMiddleware implements NestMiddleware {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const route = resolveRoute(pathnameOf(request.originalUrl));
    if (route.kind !== 'proxy' || SKIP_PREFIXES.has(route.prefix)) return next();

    const token = bearerToken(request.headers.authorization);
    if (!token) return next();

    try {
      await this.verifier.verify(token);
    } catch {
      response.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw new AppException(401, 'TOKEN_INVALID', 'Sua sessão expirou. Entre novamente.');
    }
    next();
  }
}

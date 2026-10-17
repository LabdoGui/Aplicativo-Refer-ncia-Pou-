import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TOKEN_VERIFIER, tokenVerificationException, type TokenVerifier } from '@pulso/common';
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
 * serviços sempre revalidam o token, papel e escopo. As rotas do próprio
 * gateway não passam por aqui: o AuthGuard global cuida delas.
 *
 * Token inválido → 401 TOKEN_INVALID; chaves (JWKS) indisponíveis → 503
 * AUTH_UNAVAILABLE, para o frontend não tratar a falha como sessão vencida.
 */
@Injectable()
export class EdgeAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EdgeAuthMiddleware.name);

  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const route = resolveRoute(pathnameOf(request.originalUrl));
    if (route.kind !== 'proxy' || SKIP_PREFIXES.has(route.prefix)) return next();

    const token = bearerToken(request.headers.authorization);
    if (!token) return next();

    try {
      await this.verifier.verify(token);
    } catch (error) {
      const exception = tokenVerificationException(error, this.logger, {
        requestId: (request as Request & { id?: unknown }).id,
        path: pathnameOf(request.originalUrl),
        service: route.service,
      });
      if (exception.getStatus() === 401) {
        response.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      }
      throw exception;
    }
    next();
  }
}

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { hasPermission, HEADERS, type AuthUser, type Permission, type Role } from '@pulso/contracts';
import { AppException } from '../errors/app.exception';
import { APP_CONFIG, TOKEN_VERIFIER } from '../tokens';
import type { BaseEnv } from '../config/env';
import type { TokenVerifier } from './token-verifier';
import { IS_INTERNAL_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from './decorators';

interface GuardRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Guard global de autenticação e autorização.
 *
 * Ordem: rota interna (token de serviço) → JWT → papel → permissões.
 * A posse do recurso (doador só acessa o que é seu) é verificada no caso de uso.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(APP_CONFIG) private readonly config: BaseEnv,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    const request = context.switchToHttp().getRequest<GuardRequest>();

    if (this.reflector.getAllAndOverride<boolean>(IS_INTERNAL_KEY, targets)) {
      const provided = request.headers[HEADERS.internalToken];
      if (typeof provided === 'string' && safeEqual(provided, this.config.INTERNAL_API_TOKEN)) {
        return true;
      }
      throw new AppException(401, 'INTERNAL_AUTH_REQUIRED', 'Rota restrita à comunicação entre serviços.');
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ?? false;
    const token = this.extractBearer(request);

    if (!token) {
      if (isPublic) return true;
      throw new AppException(401, 'AUTH_REQUIRED', 'Entre na sua conta para continuar.');
    }

    try {
      request.user = await this.verifier.verify(token);
    } catch {
      if (isPublic) return true;
      throw new AppException(401, 'TOKEN_INVALID', 'Sua sessão expirou. Entre novamente.');
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && roles.length > 0 && !roles.includes(request.user.role)) {
      throw new AppException(403, 'FORBIDDEN_ROLE', 'Seu perfil não tem acesso a esta área.');
    }

    const permissions = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, targets);
    if (permissions?.some((permission) => !hasPermission(request.user!.role, permission))) {
      throw new AppException(403, 'FORBIDDEN_PERMISSION', 'Você não tem permissão para realizar esta ação.');
    }

    return true;
  }

  private extractBearer(request: GuardRequest): string | undefined {
    const header = request.headers.authorization;
    if (typeof header !== 'string') return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}

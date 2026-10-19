import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import {
  hasPermission,
  HEADERS,
  type AuthUser,
  type Permission,
  type Role,
} from '@pulso/contracts';
import { AppException } from '../errors/app.exception';
import { APP_CONFIG, TOKEN_VERIFIER } from '../tokens';
import type { BaseEnv } from '../config/env';
import type { TokenVerifier } from './token-verifier';
import { DELETED_ACCOUNTS, type DeletedAccounts } from './deleted-accounts';
import { classifyVerificationError, tokenVerificationException } from './token-verification-error';
import { IS_INTERNAL_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from './decorators';

interface GuardRequest {
  id?: unknown;
  method?: string;
  originalUrl?: string;
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
 * `@Roles`/`@RequirePermissions` sempre exigem token válido, mesmo em rota ou
 * classe marcada com `@Public()`.
 * A posse do recurso (doador só acessa o que é seu) é verificada no caso de uso.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(APP_CONFIG) private readonly config: BaseEnv,
    @Optional()
    @Inject(DELETED_ACCOUNTS)
    private readonly deletedAccounts?: DeletedAccounts,
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
      throw new AppException(
        401,
        'INTERNAL_AUTH_REQUIRED',
        'Rota restrita à comunicação entre serviços.',
      );
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const permissions = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    // Exigência de papel ou permissão vale mais que @Public (ex.: classe pública com método de ADMIN).
    const requiresAuthorization = (roles?.length ?? 0) > 0 || (permissions?.length ?? 0) > 0;
    const isPublic =
      !requiresAuthorization &&
      (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ?? false);
    const token = this.extractBearer(request);

    if (!token) {
      if (isPublic) return true;
      throw new AppException(401, 'AUTH_REQUIRED', 'Entre na sua conta para continuar.');
    }

    let user: AuthUser;
    try {
      user = await this.verifier.verify(token);
    } catch (error) {
      if (isPublic) {
        // Rota pública: segue como anônimo, mas a indisponibilidade não passa em silêncio.
        if (classifyVerificationError(error) === 'unavailable') {
          this.logger.warn(
            { err: error, requestId: request.id, path: request.originalUrl },
            'Token não validado (chaves indisponíveis); seguindo como anônimo em rota pública',
          );
        }
        return true;
      }
      throw tokenVerificationException(error, this.logger, {
        requestId: request.id,
        path: request.originalUrl,
      });
    }
    request.user = user;

    // Conta excluída com token ainda válido: nenhuma escrita (LGPD, exclusão definitiva).
    const writes = !['GET', 'HEAD', 'OPTIONS'].includes((request.method ?? 'GET').toUpperCase());
    if (writes && this.deletedAccounts && (await this.deletedAccounts.isDeleted(user.id))) {
      throw new AppException(401, 'SESSION_EXPIRED', 'Sua sessão foi encerrada. Entre novamente.');
    }

    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      throw new AppException(403, 'FORBIDDEN_ROLE', 'Seu perfil não tem acesso a esta área.');
    }

    if (permissions?.some((permission) => !hasPermission(user.role, permission))) {
      throw new AppException(
        403,
        'FORBIDDEN_PERMISSION',
        'Você não tem permissão para realizar esta ação.',
      );
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

import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser, Permission, Role } from '@pulso/contracts';

export const IS_PUBLIC_KEY = 'pulso:isPublic';
export const IS_INTERNAL_KEY = 'pulso:isInternal';
export const ROLES_KEY = 'pulso:roles';
export const PERMISSIONS_KEY = 'pulso:permissions';

/** Rota acessível sem token. Se houver token válido, o usuário ainda é anexado. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Rota só para chamadas entre serviços (cabeçalho x-internal-token). */
export const InternalOnly = () => SetMetadata(IS_INTERNAL_KEY, true);

/** Exige um dos papéis informados. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Exige todas as permissões informadas (mapa papel → permissões em @pulso/contracts). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Injeta o usuário autenticado (ou `undefined` em rotas públicas sem token). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<{ user?: AuthUser }>().user,
);

/** Injeta o id da requisição (propagado pelo gateway em x-request-id). */
export const RequestId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ id?: string; headers: Record<string, string> }>();
  return request.id ?? request.headers['x-request-id'];
});

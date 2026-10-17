import type { AuthUser } from '@pulso/contracts';
import { AppException } from '../errors/app.exception';

/** Garante que o usuário da equipe atende a unidade (escopo por unidade). */
export function assertUnitScope(user: AuthUser, unitId: string): void {
  if (user.role === 'ADMIN') return;
  if (!user.unitIds.includes(unitId)) {
    throw new AppException(
      403,
      'UNIT_SCOPE',
      'Você não está vinculado a esta unidade. Fale com a administração.',
    );
  }
}

/** Usuário obrigatório (rotas autenticadas). */
export function requireUser(user: AuthUser | undefined): AuthUser {
  if (!user) throw new AppException(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.');
  return user;
}

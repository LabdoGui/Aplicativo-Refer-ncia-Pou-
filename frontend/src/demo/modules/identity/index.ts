/**
 * Módulo identity da demonstração (espelho do identity-service): contas,
 * sessão, perfil, consentimentos e administração de usuários.
 *
 * - auth.ts: /auth (cadastro, login, refresh, logout)
 * - account.ts: /users/me e /consents/me
 * - admin.ts: /admin/users
 * - internal.ts: rotas /internal usadas pelos outros serviços
 * - session.ts: sessões e bloqueio por tentativas de senha
 */
import { registerAccountRoutes } from './account';
import { registerAdminRoutes } from './admin';
import { registerAuthRoutes } from './auth';
import { registerIdentityInternal } from './internal';

export type { IdentityConsent, IdentityDonorProfile, IdentityState, IdentityUser } from './model';
export { SERVICE } from './model';
export { seedIdentity } from './seed';
export { resolveAccessToken } from './session';

export function registerIdentity(): void {
  registerAuthRoutes();
  registerAccountRoutes();
  registerAdminRoutes();
  registerIdentityInternal();
}

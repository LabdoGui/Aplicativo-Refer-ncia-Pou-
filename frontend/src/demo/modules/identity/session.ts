/**
 * Sessões (access token + família de refresh token) e bloqueio por tentativas
 * de senha, como o AuthService do identity-service.
 */
import { SESSION_HINT_COOKIE_NAME, type AuthSession, type AuthUser } from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { fail } from '../../core/http';
import { db } from '../../core/state';
import { nowIso, uuid } from '../../core/support';
import { SERVICE, state, toSessionUser, type IdentityUser } from './model';

const ACCESS_TOKEN_TTL_SECONDS = 900;

/** Tentativas de senha erradas antes do bloqueio temporário da conta. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

function setSessionHint(active: boolean): void {
  try {
    document.cookie = active
      ? `${SESSION_HINT_COOKIE_NAME}=1; path=/; SameSite=Strict`
      : `${SESSION_HINT_COOKIE_NAME}=; path=/; Max-Age=0; SameSite=Strict`;
  } catch {
    // Sem cookies (iframe isolado): a sessão só não volta ao recarregar.
  }
}

/** Remove o "cookie" do refresh token deste aparelho (clearRefreshCookie). */
export function clearDeviceSession(): void {
  state().deviceFamilyId = null;
  setSessionHint(false);
}

/** Emite uma sessão: access token + "cookie" do refresh token deste aparelho. */
export function issueSession(user: IdentityUser, familyId: string = uuid()): AuthSession {
  const identity = state();
  if (!identity.sessions.some((session) => session.familyId === familyId)) {
    identity.sessions.push({ familyId, userId: user.id, revokedAt: null });
  }
  // Tokens vencidos não servem para mais nada: não precisam ocupar o armazenamento local.
  const now = Date.now();
  for (const [token, entry] of Object.entries(identity.accessTokens)) {
    if (Date.parse(entry.expiresAt) <= now) delete identity.accessTokens[token];
  }
  const token = `demo.${uuid()}`;
  identity.accessTokens[token] = {
    userId: user.id,
    familyId,
    expiresAt: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
  };
  identity.deviceFamilyId = familyId;
  setSessionHint(true);
  return { accessToken: token, expiresIn: ACCESS_TOKEN_TTL_SECONDS, user: toSessionUser(user) };
}

/** Revoga uma família de sessão (todos os tokens dela deixam de valer). */
export function revokeFamily(familyId: string): void {
  const identity = state();
  for (const session of identity.sessions) {
    if (session.familyId === familyId && !session.revokedAt) session.revokedAt = nowIso();
  }
  for (const [token, entry] of Object.entries(identity.accessTokens)) {
    if (entry.familyId === familyId) delete identity.accessTokens[token];
  }
  if (identity.deviceFamilyId === familyId) clearDeviceSession();
}

/** Revoga todas as sessões de um usuário, exceto (opcionalmente) a atual (revokeAllSessions). */
export function revokeUserSessions(userId: string, exceptFamilyId?: string): void {
  for (const session of state().sessions) {
    if (session.userId === userId && !session.revokedAt && session.familyId !== exceptFamilyId) {
      revokeFamily(session.familyId);
    }
  }
}

/** Resolve o access token (Bearer) para o usuário autenticado, ou null. */
export function resolveAccessToken(token: string): AuthUser | null {
  const identity = db().identity;
  const entry = identity.accessTokens[token];
  if (!entry || Date.parse(entry.expiresAt) <= Date.now()) return null;
  const session = identity.sessions.find((candidate) => candidate.familyId === entry.familyId);
  const user = identity.users.find((candidate) => candidate.id === entry.userId);
  if (!session || session.revokedAt || !user || user.status !== 'ACTIVE') return null;
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    unitIds: user.professional?.unitIds ?? [],
    sessionId: entry.familyId,
  };
}

// --- Tentativas de senha (login, troca de senha e exclusão da conta) ----------
// Versão simplificada do contador atômico do back-end (não há concorrência aqui):
// 5 senhas erradas seguidas bloqueiam a conta por 15 minutos.

function lockedError(remainingMs: number): never {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return fail(
    429,
    'ACCOUNT_LOCKED',
    remainingMs > 0
      ? `Muitas tentativas com senha incorreta. Tente novamente em ${minutes} minuto(s).`
      : 'Muitas tentativas ao mesmo tempo. Aguarde alguns instantes e tente novamente.',
  );
}

/** Antes de conferir a senha: conta bloqueada não confere nada. */
export function reservePasswordAttempt(user: IdentityUser): void {
  const remainingMs = user.lockedUntil ? Date.parse(user.lockedUntil) - Date.now() : 0;
  if (remainingMs > 0) lockedError(remainingMs);
}

/** Senha certa: zera o contador. */
export function confirmPasswordAttempt(user: IdentityUser): void {
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
}

/** Senha errada: conta a tentativa, bloqueia no limite e registra a falha (e o bloqueio). */
export function registerFailedPassword(user: IdentityUser, action: string): void {
  user.failedLoginAttempts += 1;
  const locked = user.failedLoginAttempts >= MAX_FAILED_LOGINS;
  if (locked) {
    user.failedLoginAttempts = 0;
    user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
  }
  recordAudit(SERVICE, { actor: null, action, entity: 'user', entityId: user.id });
  if (locked) {
    recordAudit(SERVICE, {
      actor: null,
      action: 'auth.account_locked',
      entity: 'user',
      entityId: user.id,
    });
  }
}

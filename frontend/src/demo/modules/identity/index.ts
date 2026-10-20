/**
 * Módulo identity da demonstração (espelho do identity-service): contas,
 * sessão, perfil, consentimentos e administração de usuários.
 */
import {
  SESSION_HINT_COOKIE_NAME,
  TERMS_VERSION,
  type AuthSession,
  type AuthUser,
  type BloodType,
  type MeResponse,
  type Role,
  type SessionUser,
  type UserStatus,
} from '@pulso/contracts';
import { SEED_PASSWORD } from '@backend/libs/common/src/seed/dataset';
import { recordAudit } from '../../core/audit';
import { fail, noContent, ok, route, type DemoRequest } from '../../core/http';
import { internal } from '../../core/internal';
import { db, type SeedContext } from '../../core/state';
import { ageOn, nowIso, uuid } from '../../core/support';

export interface IdentityDonorProfile {
  donorCode: string;
  /** AAAA-MM-DD */
  birthDate: string;
  phone: string | null;
  declaredBloodType: BloodType | null;
  city: string | null;
}

export interface IdentityUser {
  id: string;
  email: string;
  /** Demonstração local: a senha fica no próprio aparelho (dados fictícios). */
  password: string;
  name: string;
  role: Role;
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  donor: IdentityDonorProfile | null;
  professional: { unitIds: string[]; registryNumber: string | null } | null;
}

export interface IdentityConsent {
  userId: string;
  purpose: 'TERMS_PRIVACY' | 'COMMUNICATIONS';
  granted: boolean;
  version: string;
  grantedAt: string | null;
  revokedAt: string | null;
  updatedAt: string;
}

export interface IdentityState {
  users: IdentityUser[];
  consents: IdentityConsent[];
  /** Famílias de sessão (equivalem às famílias de refresh token). */
  sessions: Array<{ familyId: string; userId: string; revokedAt: string | null }>;
  /** Access tokens emitidos (opacos na demonstração). */
  accessTokens: Record<string, { userId: string; familyId: string; expiresAt: string }>;
  /** O "cookie" do refresh token deste aparelho. */
  deviceFamilyId: string | null;
}

export const SERVICE = 'identity';
const ACCESS_TOKEN_TTL_SECONDS = 900;

export function seedIdentity({ dataset }: SeedContext): IdentityState {
  const users: IdentityUser[] = [];
  const consents: IdentityConsent[] = [];
  for (const [index, user] of dataset.users.entries()) {
    users.push({
      id: user.id,
      email: user.email,
      password: SEED_PASSWORD,
      name: user.name,
      role: user.role,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
      donor: user.donor
        ? {
            donorCode: user.donor.donorCode,
            birthDate: user.donor.birthDate,
            phone: user.donor.phone,
            declaredBloodType: index % 3 === 0 ? null : user.donor.bloodType,
            city: user.donor.city,
          }
        : null,
      professional:
        user.role !== 'DONOR'
          ? { unitIds: user.unitIds, registryNumber: user.registryNumber }
          : null,
    });
    consents.push(
      {
        userId: user.id,
        purpose: 'TERMS_PRIVACY',
        granted: true,
        version: TERMS_VERSION,
        grantedAt: user.createdAt,
        revokedAt: null,
        updatedAt: user.createdAt,
      },
      {
        userId: user.id,
        purpose: 'COMMUNICATIONS',
        granted: index % 5 !== 0,
        version: TERMS_VERSION,
        grantedAt: index % 5 !== 0 ? user.createdAt : null,
        revokedAt: null,
        updatedAt: user.createdAt,
      },
    );
  }
  return { users, consents, sessions: [], accessTokens: {}, deviceFamilyId: null };
}

// --- Funções compartilhadas pelo módulo --------------------------------------

export const state = () => db().identity;

export function findUser(id: string): IdentityUser | undefined {
  return state().users.find((user) => user.id === id);
}

export function requireUser(id: string): IdentityUser {
  const user = findUser(id);
  if (!user) fail(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
  return user;
}

export function toSessionUser(user: IdentityUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    unitIds: user.professional?.unitIds ?? [],
  };
}

export function toMe(user: IdentityUser): MeResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    unitIds: user.professional?.unitIds ?? [],
    createdAt: user.createdAt,
    donor: user.donor ? { ...user.donor } : null,
  };
}

function setSessionHint(active: boolean): void {
  try {
    document.cookie = active
      ? `${SESSION_HINT_COOKIE_NAME}=1; path=/; SameSite=Strict`
      : `${SESSION_HINT_COOKIE_NAME}=; path=/; Max-Age=0; SameSite=Strict`;
  } catch {
    // Sem cookies (iframe isolado): a sessão só não volta ao recarregar.
  }
}

/** Emite uma sessão: access token + "cookie" do refresh token deste aparelho. */
export function issueSession(user: IdentityUser, familyId: string = uuid()): AuthSession {
  const identity = state();
  if (!identity.sessions.some((session) => session.familyId === familyId)) {
    identity.sessions.push({ familyId, userId: user.id, revokedAt: null });
  }
  const token = `demo.${uuid()}`;
  identity.accessTokens[token] = {
    userId: user.id,
    familyId,
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
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
  if (identity.deviceFamilyId === familyId) {
    identity.deviceFamilyId = null;
    setSessionHint(false);
  }
}

/** Revoga todas as sessões de um usuário, exceto (opcionalmente) a atual. */
export function revokeUserSessions(userId: string, exceptFamilyId?: string): void {
  for (const session of state().sessions) {
    if (session.userId === userId && session.familyId !== exceptFamilyId)
      revokeFamily(session.familyId);
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

// Declarações de função (não arrow): o TypeScript só estreita tipos depois de chamadas a
// funções `never` declaradas assim.
function INVALID_CREDENTIALS(): never {
  return fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
}
function SESSION_EXPIRED(): never {
  return fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
}

// --- Rotas -------------------------------------------------------------------

function login(request: DemoRequest) {
  const email = String(request.body.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(request.body.password ?? '');
  const user = state().users.find((candidate) => candidate.email === email);
  if (!user || user.status === 'ANONYMIZED') INVALID_CREDENTIALS();
  if (user.password !== password) {
    recordAudit(SERVICE, {
      actor: null,
      action: 'auth.login_failed',
      entity: 'user',
      entityId: user.id,
    });
    INVALID_CREDENTIALS();
  }
  if (user.status === 'DISABLED') {
    fail(403, 'ACCOUNT_DISABLED', 'Esta conta está desativada. Fale com a administração.');
  }
  user.lastLoginAt = nowIso();
  recordAudit(SERVICE, {
    actor: { id: user.id, role: user.role },
    action: 'auth.login',
    entity: 'user',
    entityId: user.id,
  });
  return ok(issueSession(user));
}

function refresh() {
  const identity = state();
  const familyId = identity.deviceFamilyId;
  if (!familyId) SESSION_EXPIRED();
  const session = identity.sessions.find((candidate) => candidate.familyId === familyId);
  const user = session ? findUser(session.userId) : undefined;
  if (!session || session.revokedAt || !user || user.status !== 'ACTIVE') {
    identity.deviceFamilyId = null;
    setSessionHint(false);
    SESSION_EXPIRED();
  }
  return ok(issueSession(user, familyId));
}

function logout() {
  const identity = state();
  const familyId = identity.deviceFamilyId;
  if (familyId) {
    const session = identity.sessions.find((candidate) => candidate.familyId === familyId);
    const user = session ? findUser(session.userId) : undefined;
    revokeFamily(familyId);
    if (user) {
      recordAudit(SERVICE, {
        actor: { id: user.id, role: user.role },
        action: 'auth.logout',
        entity: 'session',
        entityId: familyId,
      });
    }
  }
  return noContent();
}

export function registerIdentity(): void {
  route('POST', '/auth/login', login, { auth: 'public' });
  route('POST', '/auth/refresh', refresh, { auth: 'public' });
  route('POST', '/auth/logout', logout, { auth: 'public' });
  route('GET', '/users/me', (request) => toMe(requireUser(request.user.id)));

  internal.identity.donorSummaries = (ids) =>
    state()
      .users.filter((user) => ids.includes(user.id))
      .map((user) => ({
        id: user.id,
        name: user.status === 'ANONYMIZED' ? 'Conta removida' : user.name,
        donorCode: user.donor?.donorCode ?? '—',
        age: user.donor ? ageOn(user.donor.birthDate) : null,
        declaredBloodType: user.donor?.declaredBloodType ?? null,
      }));
  internal.identity.communicationsConsent = (ids) => ({
    granted: state()
      .consents.filter(
        (consent) =>
          ids.includes(consent.userId) &&
          consent.purpose === 'COMMUNICATIONS' &&
          consent.granted &&
          findUser(consent.userId)?.status === 'ACTIVE',
      )
      .map((consent) => consent.userId),
  });
  internal.identity.usersByRole = (role) =>
    state()
      .users.filter((user) => user.role === role && user.status === 'ACTIVE')
      .map((user) => ({ id: user.id }));
}

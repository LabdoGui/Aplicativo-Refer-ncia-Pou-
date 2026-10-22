/**
 * Modelo do identity na demonstração: tabelas (users, perfis, consents,
 * refresh tokens) e os mapeamentos para os contratos da API.
 */
import {
  CONSENT_PURPOSES,
  type AdminUserView,
  type BloodType,
  type ConsentPurpose,
  type ConsentView,
  type MeResponse,
  type Role,
  type SessionUser,
  type UserStatus,
} from '@pulso/contracts';
import { fail } from '../../core/http';
import { db } from '../../core/state';

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
  purpose: ConsentPurpose;
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

/** Texto de cada finalidade, exibido na tela de privacidade (consent-catalog.ts). */
export const CONSENT_CATALOG: Record<
  ConsentPurpose,
  { title: string; description: string; required: boolean }
> = {
  TERMS_PRIVACY: {
    title: 'Termos de Uso e Política de Privacidade',
    description:
      'Necessário para usar o Pulso: tratamos seus dados de cadastro para agendar doações e registrar seu histórico.',
    required: true,
  },
  COMMUNICATIONS: {
    title: 'Lembretes e comunicações',
    description:
      'Receber lembretes de agendamento e avisos de campanhas. Você pode desativar quando quiser.',
    required: false,
  },
};

export const state = () => db().identity;

export function findUser(id: string): IdentityUser | undefined {
  return state().users.find((user) => user.id === id);
}

export function findUserByEmail(email: string): IdentityUser | undefined {
  return state().users.find((user) => user.email === email);
}

/** Conta do próprio usuário (AccountService.load): excluída conta como inexistente. */
export function requireUser(id: string): IdentityUser {
  const user = findUser(id);
  if (!user || user.status === 'ANONYMIZED') {
    fail(404, 'USER_NOT_FOUND', 'Conta não encontrada.');
  }
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

export function toAdminView(user: IdentityUser): AdminUserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    unitIds: user.professional?.unitIds ?? [],
    registryNumber: user.professional?.registryNumber ?? null,
    donorCode: user.donor?.donorCode ?? null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

/** Consentimentos do usuário, um por finalidade do catálogo (AccountService.consents). */
export function consentsOf(userId: string): ConsentView[] {
  const rows = state().consents.filter((consent) => consent.userId === userId);
  return CONSENT_PURPOSES.map((purpose) => {
    const catalog = CONSENT_CATALOG[purpose];
    const row = rows.find((candidate) => candidate.purpose === purpose);
    return {
      purpose,
      title: catalog.title,
      description: catalog.description,
      required: catalog.required,
      granted: row?.granted ?? false,
      version: row?.version ?? null,
      grantedAt: row?.grantedAt ?? null,
      revokedAt: row?.revokedAt ?? null,
    };
  });
}

import type { BloodType, ConsentPurpose, UserStatus } from '../domain';
import type { Role } from '../roles';

/**
 * Política de senha (front-end e identity usam a mesma): de 8 a 128
 * caracteres, com pelo menos uma letra e um número.
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  pattern: /^(?=.*[A-Za-zÀ-ÿ])(?=.*\d).+$/,
  message: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.',
} as const;

/** Idade mínima para criar conta no MVP (RN18). */
export const MIN_DONOR_AGE = 18;

/** Nome do cookie httpOnly do refresh token (Path=/api/v1/auth). */
export const REFRESH_COOKIE_NAME = 'pulso_refresh';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  unitIds: string[];
}

/** Resposta de login, cadastro e refresh. O refresh token vai só no cookie. */
export interface AuthSession {
  accessToken: string;
  /** Validade do access token, em segundos. */
  expiresIn: number;
  user: SessionUser;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  /** AAAA-MM-DD */
  birthDate: string;
  phone?: string;
  acceptTerms: boolean;
  acceptCommunications?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface DonorProfileView {
  donorCode: string;
  birthDate: string;
  phone: string | null;
  /** Tipo sanguíneo informado pelo próprio doador (não é laudo). */
  declaredBloodType: BloodType | null;
  city: string | null;
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  unitIds: string[];
  createdAt: string;
  donor: DonorProfileView | null;
}

export interface UpdateMeRequest {
  name?: string;
  phone?: string | null;
  declaredBloodType?: BloodType | null;
  city?: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
}

export interface ConsentView {
  purpose: ConsentPurpose;
  title: string;
  description: string;
  /** Obrigatório para usar o app (não pode ser revogado sem excluir a conta). */
  required: boolean;
  granted: boolean;
  version: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface UpdateConsentsRequest {
  consents: Array<{ purpose: ConsentPurpose; granted: boolean }>;
}

/** Cópia dos dados pessoais guardados pelo identity (direito de acesso, LGPD art. 18). */
export interface PersonalDataExport {
  generatedAt: string;
  account: MeResponse;
  consents: ConsentView[];
  notice: string;
}

/** Resumo do doador para a equipe da unidade (sem dados clínicos). */
export interface DonorSummary {
  id: string;
  name: string;
  donorCode: string;
  age: number | null;
  declaredBloodType: BloodType | null;
}

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  unitIds: string[];
  registryNumber: string | null;
  donorCode: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export type StaffRole = Exclude<Role, 'DONOR'>;

export interface CreateStaffUserRequest {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  unitIds: string[];
  registryNumber?: string;
}

export interface UpdateUserRequest {
  name?: string;
  role?: StaffRole;
  status?: 'ACTIVE' | 'DISABLED';
  unitIds?: string[];
  registryNumber?: string | null;
}

export interface AdminUsersQuery {
  role?: Role;
  status?: UserStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

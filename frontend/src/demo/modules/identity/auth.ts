/** Rotas /auth (auth.controller.ts + auth.service.ts). */
import { EVENTS, MIN_DONOR_AGE, TERMS_VERSION, type UserRegisteredData } from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { publish } from '../../core/events';
import { created, fail, noContent, ok, route, type DemoRequest } from '../../core/http';
import { ageOn, humanCode, nowIso, todayLocal, uuid } from '../../core/support';
import { findUser, findUserByEmail, SERVICE, state, type IdentityUser } from './model';
import {
  clearDeviceSession,
  confirmPasswordAttempt,
  issueSession,
  registerFailedPassword,
  reservePasswordAttempt,
  revokeFamily,
} from './session';
import {
  bodyOf,
  isCalendarDate,
  Issues,
  NAME_MESSAGE,
  normalizedEmail,
  PERSON_NAME,
  PHONE,
  PHONE_MESSAGE,
  trimmed,
} from './validation';

// Declarações de função (não arrow): o TypeScript só estreita tipos depois de chamadas a
// funções `never` declaradas assim.
function INVALID_CREDENTIALS(): never {
  return fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
}
function SESSION_EXPIRED(): never {
  return fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  birthDate: string;
  phone?: string;
  acceptCommunications?: boolean;
}

/** RegisterDto: mesmos @Transform e regras de validação. */
function parseRegister(raw: unknown): RegisterInput {
  const body = bodyOf(raw);
  const issues = new Issues();
  issues.unknown(body, [
    'name',
    'email',
    'password',
    'birthDate',
    'phone',
    'acceptTerms',
    'acceptCommunications',
  ]);
  const name = trimmed(body.name);
  const email = normalizedEmail(body.email);
  const phone = trimmed(body.phone);
  issues.text('name', name, {
    min: 3,
    max: 120,
    pattern: PERSON_NAME,
    patternMessage: NAME_MESSAGE,
  });
  issues.email('email', email);
  issues.password('password', body.password);
  if (typeof body.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.birthDate)) {
    issues.add('birthDate', 'Informe a data no formato AAAA-MM-DD.');
  }
  if (typeof body.birthDate !== 'string' || !isCalendarDate(body.birthDate)) {
    issues.add('birthDate', 'Informe uma data válida.');
  }
  if (phone !== undefined && phone !== null) {
    issues.text('phone', phone, { pattern: PHONE, patternMessage: PHONE_MESSAGE });
  }
  if (body.acceptTerms !== true) {
    issues.add('acceptTerms', 'É preciso aceitar os Termos de Uso e a Política de Privacidade.');
    issues.boolean('acceptTerms', body.acceptTerms);
  }
  if (body.acceptCommunications !== undefined && body.acceptCommunications !== null) {
    issues.boolean('acceptCommunications', body.acceptCommunications);
  }
  issues.check();
  return {
    name: name as string,
    email: email as string,
    password: body.password as string,
    birthDate: body.birthDate as string,
    phone: (phone ?? undefined) as string | undefined,
    acceptCommunications: (body.acceptCommunications ?? undefined) as boolean | undefined,
  };
}

function uniqueDonorCode(): string {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = humanCode('PUL');
    if (!state().users.some((user) => user.donor?.donorCode === code)) return code;
  }
  throw new Error('Não foi possível gerar um código de doador único');
}

/** Cadastro de doador (RN18: maiores de 18 anos), com login automático. */
function register(request: DemoRequest) {
  const dto = parseRegister(request.body);
  const today = todayLocal();
  if (dto.birthDate > today) {
    fail(400, 'INVALID_BIRTH_DATE', 'A data de nascimento não pode ser futura.', undefined, [
      { field: 'birthDate', message: 'A data de nascimento não pode ser futura.' },
    ]);
  }
  const age = ageOn(dto.birthDate, today);
  if (age > 120) {
    fail(400, 'INVALID_BIRTH_DATE', 'Confira a data de nascimento.', undefined, [
      { field: 'birthDate', message: 'Confira a data de nascimento.' },
    ]);
  }
  if (age < MIN_DONOR_AGE) {
    fail(
      422,
      'AGE_RESTRICTION',
      'O cadastro no SangueConecta é para maiores de 18 anos. Se você tem 16 ou 17 anos, procure diretamente uma unidade de coleta.',
    );
  }
  // E-mail é único (inclusive entre contas desativadas): no banco, a restrição unique.
  if (findUserByEmail(dto.email)) {
    fail(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado. Entre com sua senha.', undefined, [
      { field: 'email', message: 'Este e-mail já está cadastrado.' },
    ]);
  }

  const now = nowIso();
  const communications = dto.acceptCommunications === true;
  const user: IdentityUser = {
    id: uuid(),
    email: dto.email,
    password: dto.password,
    name: dto.name,
    role: 'DONOR',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    donor: {
      donorCode: uniqueDonorCode(),
      birthDate: dto.birthDate,
      phone: dto.phone || null,
      declaredBloodType: null,
      city: null,
    },
    professional: null,
  };
  const identity = state();
  identity.users.push(user);
  identity.consents.push(
    {
      userId: user.id,
      purpose: 'TERMS_PRIVACY',
      granted: true,
      version: TERMS_VERSION,
      grantedAt: now,
      revokedAt: null,
      updatedAt: now,
    },
    {
      userId: user.id,
      purpose: 'COMMUNICATIONS',
      granted: communications,
      version: TERMS_VERSION,
      grantedAt: communications ? now : null,
      revokedAt: null,
      updatedAt: now,
    },
  );
  publish<UserRegisteredData>(EVENTS.USER_REGISTERED, {
    userId: user.id,
    name: user.name,
    role: user.role,
  });
  recordAudit(SERVICE, {
    actor: { id: user.id, role: user.role },
    action: 'user.registered',
    entity: 'user',
    entityId: user.id,
    metadata: { communications, termsVersion: TERMS_VERSION },
  });
  return created(issueSession(user));
}

function login(request: DemoRequest) {
  const body = bodyOf(request.body);
  const email = normalizedEmail(body.email);
  const issues = new Issues();
  issues.unknown(body, ['email', 'password']);
  issues.email('email', email);
  issues.passwordToCheck('password', body.password);
  issues.check();

  const user = findUserByEmail(email as string);
  if (!user || user.status === 'ANONYMIZED') INVALID_CREDENTIALS();

  reservePasswordAttempt(user);
  if (user.password !== body.password) {
    registerFailedPassword(user, 'auth.login_failed');
    INVALID_CREDENTIALS();
  }
  confirmPasswordAttempt(user);

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
    clearDeviceSession();
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
  clearDeviceSession();
  return noContent();
}

export function registerAuthRoutes(): void {
  route('POST', '/auth/register', register, { auth: 'public' });
  route('POST', '/auth/login', login, { auth: 'public' });
  route('POST', '/auth/refresh', refresh, { auth: 'public' });
  route('POST', '/auth/logout', logout, { auth: 'public' });
}

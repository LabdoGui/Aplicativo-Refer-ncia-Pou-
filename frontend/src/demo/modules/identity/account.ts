/** Rotas "Minha conta": /users/me e /consents/me (account.controller.ts + account.service.ts). */
import {
  BLOOD_TYPES,
  CONSENT_PURPOSES,
  EVENTS,
  TERMS_VERSION,
  type BloodType,
  type ConsentPurpose,
  type PersonalDataExport,
  type UpdateMeRequest,
  type UserDeletedData,
} from '@pulso/contracts';
import { recordAudit, type AuditRecord } from '../../core/audit';
import { publish } from '../../core/events';
import { fail, noContent, route, type AuthedRequest } from '../../core/http';
import { nowIso, uuid } from '../../core/support';
import { CONSENT_CATALOG, consentsOf, requireUser, SERVICE, state, toMe } from './model';
import {
  clearDeviceSession,
  confirmPasswordAttempt,
  registerFailedPassword,
  reservePasswordAttempt,
  revokeUserSessions,
} from './session';
import {
  bodyOf,
  Issues,
  NAME_MESSAGE,
  PERSON_NAME,
  PHONE,
  PHONE_MESSAGE,
  trimmed,
} from './validation';

const UPDATE_ME_FIELDS = ['name', 'phone', 'declaredBloodType', 'city'] as const;

/** UpdateMeDto: campos opcionais; telefone, tipo e cidade aceitam null. */
function parseUpdateMe(raw: unknown): UpdateMeRequest {
  const body = bodyOf(raw);
  const issues = new Issues();
  issues.unknown(body, UPDATE_ME_FIELDS);
  const dto: UpdateMeRequest = {};
  const name = trimmed(body.name);
  if (name !== undefined && name !== null) {
    issues.text('name', name, {
      min: 3,
      max: 120,
      pattern: PERSON_NAME,
      patternMessage: NAME_MESSAGE,
    });
    dto.name = name as string;
  }
  const phone = trimmed(body.phone);
  if (phone !== undefined) {
    if (phone !== null)
      issues.text('phone', phone, { pattern: PHONE, patternMessage: PHONE_MESSAGE });
    dto.phone = phone as string | null;
  }
  if (body.declaredBloodType !== undefined) {
    if (body.declaredBloodType !== null) {
      issues.oneOf('declaredBloodType', body.declaredBloodType, BLOOD_TYPES);
    }
    dto.declaredBloodType = body.declaredBloodType as BloodType | null;
  }
  const city = trimmed(body.city);
  if (city !== undefined) {
    if (city !== null) issues.text('city', city, { max: 80 });
    dto.city = city as string | null;
  }
  issues.check();
  return dto;
}

function updateMe(request: AuthedRequest) {
  const dto = parseUpdateMe(request.body);
  const user = requireUser(request.user.id);
  const donorFields = ['phone', 'declaredBloodType', 'city'] as const;
  const touchesDonor = donorFields.some((field) => dto[field] !== undefined);
  if (touchesDonor && !user.donor) {
    fail(422, 'NOT_A_DONOR', 'Esses dados existem apenas no perfil de doador.');
  }
  const changed = (Object.keys(dto) as Array<keyof UpdateMeRequest>).filter(
    (key) => dto[key] !== undefined,
  );
  if (dto.name !== undefined) user.name = dto.name;
  if (user.donor) {
    if (dto.phone !== undefined) user.donor.phone = dto.phone || null;
    if (dto.declaredBloodType !== undefined) user.donor.declaredBloodType = dto.declaredBloodType;
    if (dto.city !== undefined) user.donor.city = dto.city || null;
  }
  user.updatedAt = nowIso();
  // Só os nomes dos campos: os valores são dados pessoais.
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'user.profile_updated',
    entity: 'user',
    entityId: user.id,
    metadata: { fields: changed },
  });
  return toMe(user);
}

function changePassword(request: AuthedRequest) {
  const body = bodyOf(request.body);
  const issues = new Issues();
  issues.unknown(body, ['currentPassword', 'newPassword']);
  issues.passwordToCheck('currentPassword', body.currentPassword);
  issues.password('newPassword', body.newPassword);
  issues.check();

  const actor = request.user;
  const user = requireUser(actor.id);
  reservePasswordAttempt(user);
  if (user.password !== body.currentPassword) {
    registerFailedPassword(user, 'user.password_check_failed');
    fail(422, 'WRONG_PASSWORD', 'A senha atual não confere.', undefined, [
      { field: 'currentPassword', message: 'A senha atual não confere.' },
    ]);
  }
  confirmPasswordAttempt(user);
  if (body.currentPassword === body.newPassword) {
    fail(422, 'SAME_PASSWORD', 'A nova senha precisa ser diferente da atual.', undefined, [
      { field: 'newPassword', message: 'A nova senha precisa ser diferente da atual.' },
    ]);
  }
  user.password = body.newPassword as string;
  user.updatedAt = nowIso();
  // Outros dispositivos saem; o atual continua conectado (sessão do access token).
  revokeUserSessions(user.id, actor.sessionId ?? state().deviceFamilyId ?? undefined);
  recordAudit(SERVICE, {
    actor,
    action: 'user.password_changed',
    entity: 'user',
    entityId: user.id,
  });
  return noContent();
}

function exportData(request: AuthedRequest): PersonalDataExport {
  const actor = request.user;
  const account = toMe(requireUser(actor.id));
  const consents = consentsOf(actor.id);
  recordAudit(SERVICE, {
    actor,
    action: 'user.data_exported',
    entity: 'user',
    entityId: actor.id,
  });
  return {
    generatedAt: nowIso(),
    account,
    consents,
    notice:
      'Cópia dos dados de cadastro guardados pelo SangueConecta (identidade e consentimentos). Agendamentos, atendimentos e conquistas aparecem nas respectivas telas do app.',
  };
}

/**
 * Exclusão da conta: os dados de identificação são apagados e a conta fica
 * anonimizada. O evento identity.user.deleted leva a exclusão aos outros serviços.
 */
function deleteAccount(request: AuthedRequest) {
  const body = bodyOf(request.body);
  const issues = new Issues();
  issues.unknown(body, ['password']);
  issues.passwordToCheck('password', body.password);
  issues.check();

  const actor = request.user;
  const user = requireUser(actor.id);
  reservePasswordAttempt(user);
  if (user.password !== body.password) {
    registerFailedPassword(user, 'user.password_check_failed');
    fail(422, 'WRONG_PASSWORD', 'A senha não confere.', undefined, [
      { field: 'password', message: 'A senha não confere.' },
    ]);
  }
  confirmPasswordAttempt(user);
  if (user.role === 'ADMIN') {
    fail(
      422,
      'ADMIN_SELF_DELETE',
      'Contas de administração são removidas por outro administrador.',
    );
  }

  const identity = state();
  revokeUserSessions(user.id);
  // Refresh tokens e consentimentos são apagados (deleteMany), não só revogados.
  identity.sessions = identity.sessions.filter((session) => session.userId !== user.id);
  identity.consents = identity.consents.filter((consent) => consent.userId !== user.id);
  user.donor = null;
  user.professional = null;
  user.status = 'ANONYMIZED';
  user.name = 'Conta removida';
  user.email = `removido+${user.id}@pulso.invalid`;
  user.password = uuid() + uuid();
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.updatedAt = nowIso();
  // Os outros serviços apagam ou desvinculam o que guardam desta pessoa.
  publish<UserDeletedData>(EVENTS.USER_DELETED, { userId: user.id, occurredAt: nowIso() });
  recordAudit(SERVICE, {
    actor,
    action: 'user.account_deleted',
    entity: 'user',
    entityId: user.id,
  });
  // O controller limpa o cookie do refresh token.
  clearDeviceSession();
  return noContent();
}

/** UpdateConsentsDto: lista de 1 a 2 escolhas { purpose, granted }. */
function parseConsents(raw: unknown): Array<{ purpose: ConsentPurpose; granted: boolean }> {
  const body = bodyOf(raw);
  const issues = new Issues();
  issues.unknown(body, ['consents']);
  const list = body.consents;
  if (!Array.isArray(list)) {
    issues.add('consents', 'Deve ser um objeto válido.');
    issues.add('consents', `Informe no máximo ${CONSENT_PURPOSES.length} itens.`);
    issues.add('consents', 'Informe ao menos 1 itens.');
    issues.add('consents', 'Deve ser uma lista.');
  } else {
    if (list.length > CONSENT_PURPOSES.length) {
      issues.add('consents', `Informe no máximo ${CONSENT_PURPOSES.length} itens.`);
    }
    if (list.length < 1) issues.add('consents', 'Informe ao menos 1 itens.');
    list.forEach((item: unknown, index) => {
      const choice = bodyOf(item);
      if (choice !== item) {
        issues.add(`consents.${index}`, 'Deve ser um objeto válido.');
        return;
      }
      issues.unknown(choice, ['purpose', 'granted']);
      issues.oneOf(`consents.${index}.purpose`, choice.purpose, CONSENT_PURPOSES);
      issues.boolean(`consents.${index}.granted`, choice.granted);
    });
  }
  issues.check();
  return list as Array<{ purpose: ConsentPurpose; granted: boolean }>;
}

function updateConsents(request: AuthedRequest) {
  const choices = parseConsents(request.body);
  const actor = request.user;
  // No back-end tudo roda numa transação: um aceite obrigatório revogado desfaz o resto.
  if (choices.some((choice) => CONSENT_CATALOG[choice.purpose].required && !choice.granted)) {
    fail(
      422,
      'CONSENT_REQUIRED',
      'O aceite dos Termos de Uso é necessário para usar o SangueConecta. Para retirá-lo, exclua sua conta.',
    );
  }
  const identity = state();
  const now = nowIso();
  const audits: AuditRecord[] = [];
  for (const choice of choices) {
    const current = identity.consents.find(
      (consent) => consent.userId === actor.id && consent.purpose === choice.purpose,
    );
    if (current?.granted === choice.granted) continue;
    if (current) {
      current.granted = choice.granted;
      current.version = TERMS_VERSION;
      if (choice.granted) {
        current.grantedAt = now;
        current.revokedAt = null;
      } else {
        current.revokedAt = now;
      }
      current.updatedAt = now;
    } else {
      identity.consents.push({
        userId: actor.id,
        purpose: choice.purpose,
        granted: choice.granted,
        version: TERMS_VERSION,
        grantedAt: choice.granted ? now : null,
        revokedAt: choice.granted ? null : now,
        updatedAt: now,
      });
    }
    audits.push({
      actor,
      action: choice.granted ? 'consent.granted' : 'consent.revoked',
      entity: 'consent',
      entityId: actor.id,
      metadata: { purpose: choice.purpose, version: TERMS_VERSION },
    });
  }
  for (const entry of audits) recordAudit(SERVICE, entry);
  return consentsOf(actor.id);
}

export function registerAccountRoutes(): void {
  route('GET', '/users/me', (request) => toMe(requireUser(request.user.id)));
  route('PATCH', '/users/me', updateMe);
  route('PATCH', '/users/me/password', changePassword);
  route('GET', '/users/me/export', exportData);
  route('DELETE', '/users/me', deleteAccount);
  route('GET', '/consents/me', (request) => consentsOf(request.user.id));
  route('PUT', '/consents/me', updateConsents);
}

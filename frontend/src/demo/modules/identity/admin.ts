/** Rotas /admin/users (admin-users.controller.ts + admin-users.service.ts). */
import {
  ROLES,
  USER_STATUSES,
  type AdminUserView,
  type CreateStaffUserRequest,
  type Paginated,
  type Role,
  type StaffRole,
  type UpdateUserRequest,
  type UserStatus,
} from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { fail, route, type AuthedRequest } from '../../core/http';
import { nowIso, uuid } from '../../core/support';
import { findUser, findUserByEmail, SERVICE, state, toAdminView, type IdentityUser } from './model';
import { revokeUserSessions } from './session';
import {
  bodyOf,
  isUuid,
  Issues,
  NAME_MESSAGE,
  normalizedEmail,
  PERSON_NAME,
  trimmed,
} from './validation';

const STAFF_ROLES: StaffRole[] = ['COLLABORATOR', 'NURSE', 'ADMIN'];

function assertUnits(role: Role, unitIds: string[]): void {
  if ((role === 'NURSE' || role === 'COLLABORATOR') && unitIds.length === 0) {
    fail(422, 'UNITS_REQUIRED', 'Vincule a pessoa a pelo menos uma unidade.', undefined, [
      { field: 'unitIds', message: 'Selecione pelo menos uma unidade.' },
    ]);
  }
}

function list(request: AuthedRequest): Paginated<AdminUserView> {
  const { query } = request;
  const issues = new Issues();
  issues.unknown(query, ['role', 'status', 'search', 'page', 'pageSize']);
  const role = query.get('role');
  const status = query.get('status');
  const search = query.get('search')?.trim() ?? '';
  if (role !== null) issues.oneOf('role', role, ROLES);
  if (status !== null) issues.oneOf('status', status, USER_STATUSES);
  if (search.length > 80) issues.add('search', 'Deve ter no máximo 80 caracteres.');
  const page = issues.integer('page', query.get('page'), 1) ?? 1;
  const pageSize = issues.integer('pageSize', query.get('pageSize'), 1, 100) ?? 20;
  issues.check();

  const lowered = search.toLowerCase();
  const upper = search.toUpperCase();
  const rows = state()
    .users.filter((user) => {
      if (role && user.role !== (role as Role)) return false;
      if (status ? user.status !== (status as UserStatus) : user.status === 'ANONYMIZED') {
        return false;
      }
      if (!search) return true;
      return (
        user.name.toLowerCase().includes(lowered) ||
        user.email.includes(lowered) ||
        (user.donor?.donorCode.includes(upper) ?? false)
      );
    })
    // orderBy createdAt desc (empates: os gravados por último primeiro).
    .reverse()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const skip = (page - 1) * pageSize;
  return {
    items: rows.slice(skip, skip + pageSize).map(toAdminView),
    total: rows.length,
    page,
    pageSize,
  };
}

/** CreateStaffUserDto. */
function parseCreate(raw: unknown): CreateStaffUserRequest {
  const body = bodyOf(raw);
  const issues = new Issues();
  issues.unknown(body, ['name', 'email', 'password', 'role', 'unitIds', 'registryNumber']);
  const name = trimmed(body.name);
  const email = normalizedEmail(body.email);
  const registryNumber = trimmed(body.registryNumber);
  issues.text('name', name, {
    min: 3,
    max: 120,
    pattern: PERSON_NAME,
    patternMessage: NAME_MESSAGE,
  });
  issues.email('email', email);
  issues.password('password', body.password);
  issues.oneOf('role', body.role, STAFF_ROLES);
  issues.uuidList('unitIds', body.unitIds, 20);
  if (registryNumber !== undefined && registryNumber !== null) {
    issues.text('registryNumber', registryNumber, { max: 40 });
  }
  issues.check();
  return {
    name: name as string,
    email: email as string,
    password: body.password as string,
    role: body.role as StaffRole,
    unitIds: body.unitIds as string[],
    registryNumber: (registryNumber ?? undefined) as string | undefined,
  };
}

function create(request: AuthedRequest) {
  const dto = parseCreate(request.body);
  assertUnits(dto.role, dto.unitIds);
  if (findUserByEmail(dto.email)) {
    fail(409, 'EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', undefined, [
      { field: 'email', message: 'Já existe uma conta com este e-mail.' },
    ]);
  }
  const now = nowIso();
  const user: IdentityUser = {
    id: uuid(),
    email: dto.email,
    password: dto.password,
    name: dto.name,
    role: dto.role,
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    donor: null,
    professional: {
      unitIds: dto.role === 'ADMIN' ? [] : [...dto.unitIds],
      registryNumber: dto.registryNumber ?? null,
    },
  };
  state().users.push(user);
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'user.staff_created',
    entity: 'user',
    entityId: user.id,
    metadata: { role: dto.role, unitIds: dto.unitIds },
  });
  return toAdminView(user);
}

const UPDATE_FIELDS = ['name', 'role', 'status', 'unitIds', 'registryNumber'] as const;

/** UpdateUserDto (as chaves seguem a ordem do corpo, como no class-transformer). */
function parseUpdate(raw: unknown): UpdateUserRequest {
  const body = bodyOf(raw);
  const issues = new Issues();
  issues.unknown(body, UPDATE_FIELDS);
  const dto: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (!(UPDATE_FIELDS as readonly string[]).includes(key)) continue;
    const value = key === 'name' || key === 'registryNumber' ? trimmed(body[key]) : body[key];
    if (value === undefined) continue;
    if (value === null && key !== 'registryNumber') continue; // @IsOptional ignora null
    dto[key] = value;
  }
  if (dto.name !== undefined) {
    issues.text('name', dto.name, {
      min: 3,
      max: 120,
      pattern: PERSON_NAME,
      patternMessage: NAME_MESSAGE,
    });
  }
  if (dto.role !== undefined) issues.oneOf('role', dto.role, STAFF_ROLES);
  if (dto.status !== undefined) issues.oneOf('status', dto.status, ['ACTIVE', 'DISABLED']);
  if (dto.unitIds !== undefined) issues.uuidList('unitIds', dto.unitIds, 20);
  if (dto.registryNumber !== undefined && dto.registryNumber !== null) {
    issues.text('registryNumber', dto.registryNumber, { max: 40 });
  }
  issues.check();
  return dto as UpdateUserRequest;
}

function update(request: AuthedRequest) {
  const { id } = request.params;
  // ParseUUIDPipe: resposta genérica de 400.
  if (!isUuid(id)) fail(400, 'BAD_REQUEST', 'Verifique os dados informados e tente novamente.');
  const dto = parseUpdate(request.body);
  const actor = request.user;
  const user = findUser(id);
  if (!user || user.status === 'ANONYMIZED') {
    fail(404, 'USER_NOT_FOUND', 'Conta não encontrada.');
  }
  if (id === actor.id && (dto.status === 'DISABLED' || (dto.role && dto.role !== 'ADMIN'))) {
    fail(422, 'SELF_LOCKOUT', 'Você não pode desativar nem rebaixar a própria conta.');
  }
  if (user.role === 'DONOR' && (dto.role || dto.unitIds || dto.registryNumber !== undefined)) {
    fail(422, 'DONOR_ROLE_FIXED', 'Contas de doador só podem ser ativadas ou desativadas.');
  }
  const role: Role = dto.role ?? user.role;
  const unitIds = dto.unitIds ?? user.professional?.unitIds ?? [];
  if (role !== 'DONOR') assertUnits(role, unitIds);
  // O formulário reenvia todos os campos: só conta como mudança o que difere do atual.
  const sameUnits = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const changed = {
    role: dto.role !== undefined && dto.role !== user.role,
    unitIds:
      dto.unitIds !== undefined &&
      role !== 'ADMIN' &&
      !sameUnits(dto.unitIds, user.professional?.unitIds ?? []),
    disabled: dto.status === 'DISABLED' && user.status !== 'DISABLED',
  };
  const changedFields = (Object.keys(dto) as Array<keyof UpdateUserRequest>).filter((field) => {
    if (dto[field] === undefined) return false;
    if (field === 'role') return changed.role;
    if (field === 'unitIds') return changed.unitIds;
    if (field === 'status') return dto.status !== user.status;
    if (field === 'name') return dto.name !== user.name;
    if (field === 'registryNumber') {
      return dto.registryNumber !== (user.professional?.registryNumber ?? null);
    }
    return true;
  });

  if (dto.name !== undefined) user.name = dto.name;
  if (dto.role !== undefined) user.role = dto.role;
  if (dto.status !== undefined) user.status = dto.status;
  if (role !== 'DONOR') {
    const nextUnits = role === 'ADMIN' ? [] : [...unitIds];
    if (user.professional) {
      user.professional.unitIds = nextUnits;
      if (dto.registryNumber !== undefined) user.professional.registryNumber = dto.registryNumber;
    } else {
      user.professional = { unitIds: nextUnits, registryNumber: dto.registryNumber ?? null };
    }
  }
  user.updatedAt = nowIso();
  recordAudit(SERVICE, {
    actor,
    action: 'user.updated_by_admin',
    entity: 'user',
    entityId: id,
    metadata: {
      fields: changedFields,
      ...(changedFields.includes('status') ? { status: dto.status } : {}),
      ...(changed.role ? { role: dto.role } : {}),
    },
  });
  // Papel, unidades ou status mudaram de fato: sessões antigas não podem continuar valendo.
  if (changed.disabled || changed.role || changed.unitIds) revokeUserSessions(id);
  return toAdminView(user);
}

export function registerAdminRoutes(): void {
  const options = { permissions: ['user:manage' as const] };
  route('GET', '/admin/users', list, options);
  route('POST', '/admin/users', create, options);
  route('PATCH', '/admin/users/:id', update, options);
}

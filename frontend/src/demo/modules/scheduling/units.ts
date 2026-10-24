/**
 * Unidades, grade semanal e bloqueios (units/units.controller.ts e units.service.ts).
 */
import {
  EVENTS,
  UNIT_STATUSES,
  hasPermission,
  type AppointmentCancelledData,
  type AuthUser,
  type ScheduleBlockView,
  type ScheduleRuleInput,
  type ScheduleRuleView,
  type UnitInput,
  type UnitStatus,
  type UnitView,
} from '@pulso/contracts';
import { validateRules } from '@backend/services/scheduling/src/domain/schedule';
import { recordAudit } from '../../core/audit';
import { publish } from '../../core/events';
import { fail, noContent, route, type AuthedRequest, type DemoRequest } from '../../core/http';
import { nowIso, uuid } from '../../core/support';
import { releaseSlot } from './ledger';
import {
  SERVICE,
  UNIT_NOT_FOUND,
  byText,
  findUnit,
  isOpen,
  state,
  toBlockView,
  toRuleView,
  toUnitView,
  transaction,
  type SchedulingUnit,
} from './model';
import { Validator, is, parseUuid, queryObject, trim, type Check } from './validation';

export function canManageUnits(user: AuthUser | null | undefined): boolean {
  return !!user && hasPermission(user.role, 'unit:manage');
}

/** IncludeInactiveQueryDto. */
export function includeInactiveQuery(request: DemoRequest): boolean {
  const v = new Validator(queryObject(request.query), ['includeInactive']);
  const includeInactive = v.field('includeInactive', [is.in(['true', 'false'])], {
    optional: true,
  });
  v.done();
  return includeInactive === 'true';
}

/** Unidade existente (e ativa, salvo quando `includeInactive`). */
export function requireUnit(id: string, includeInactive = false): SchedulingUnit {
  const unit = findUnit(id);
  if (!unit || (!includeInactive && unit.status !== 'ACTIVE')) UNIT_NOT_FOUND();
  return unit;
}

// --- DTOs ----------------------------------------------------------------------

const UNIT_FIELDS = [
  'name',
  'address',
  'district',
  'city',
  'state',
  'zipCode',
  'phone',
  'openingHours',
  'status',
] as const;

const text = (min: number, max: number): Check[] => [
  is.string(),
  is.minLength(min),
  is.maxLength(max),
];

/** UnitInputDto (criação) ou UpdateUnitDto (PartialType: tudo opcional). */
function parseUnitInput(body: unknown, partial: boolean): Partial<UnitInput> {
  const v = new Validator(body, UNIT_FIELDS);
  const required = { optional: partial, type: 'string', transform: trim } as const;
  v.field('name', text(3, 120), required);
  v.field('address', text(3, 200), required);
  v.field('district', text(2, 80), required);
  v.field('city', text(2, 80), required);
  v.field(
    'state',
    [is.matches(/^[A-Z]{2}$/, 'Informe a sigla do estado com 2 letras (ex.: SP).')],
    {
      optional: partial,
      type: 'string',
      transform: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
    },
  );
  v.field('zipCode', [is.matches(/^\d{5}-\d{3}$/, 'Informe o CEP no formato 00000-000.')], {
    optional: true,
    nullable: true,
    transform: (value) =>
      typeof value === 'string' ? value.trim().replace(/^(\d{5})(\d{3})$/, '$1-$2') : value,
  });
  v.field('phone', [is.matches(/^\+?[\d\s().-]{8,20}$/, 'Informe um telefone válido.')], {
    optional: true,
    nullable: true,
    transform: trim,
  });
  v.field('openingHours', [is.string(), is.maxLength(200)], {
    optional: true,
    nullable: true,
    transform: trim,
  });
  v.field('status', [is.in(UNIT_STATUSES)], { optional: true, type: 'string' });
  v.done();
  return v.output as Partial<UnitInput>;
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const RULE_FIELDS = ['weekday', 'startTime', 'endTime', 'slotMinutes', 'capacity', 'active'];

/** ReplaceScheduleRulesDto (com ScheduleRuleInputDto aninhado). */
function parseRules(body: unknown): ScheduleRuleInput[] {
  const v = new Validator(body, ['rules']);
  const rules = v.field('rules', [is.array(), is.arrayMaxSize(50)]);
  const parsed: ScheduleRuleInput[] = [];
  if (Array.isArray(rules)) {
    rules.forEach((rule, index) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        v.issues.push({ field: `rules.${index}`, message: 'Deve ser um objeto válido.' });
        return;
      }
      const item = new Validator(rule, RULE_FIELDS, `rules.${index}`);
      item.field('weekday', [is.int(), is.min(1), is.max(7)], { type: 'number' });
      item.field('startTime', [is.matches(HH_MM, 'Use o formato HH:mm (ex.: 08:00).')], {
        type: 'string',
      });
      item.field('endTime', [is.matches(HH_MM, 'Use o formato HH:mm (ex.: 12:00).')], {
        type: 'string',
      });
      item.field('slotMinutes', [is.int(), is.min(10), is.max(120)], { type: 'number' });
      item.field('capacity', [is.int(), is.min(1), is.max(50)], { type: 'number' });
      item.field('active', [is.boolean()], { type: 'boolean' });
      v.merge(item);
      parsed.push(item.output as unknown as ScheduleRuleInput);
    });
  }
  v.done();
  return parsed.map((rule) => ({
    weekday: rule.weekday,
    startTime: rule.startTime,
    endTime: rule.endTime,
    slotMinutes: rule.slotMinutes,
    capacity: rule.capacity,
    active: rule.active,
  }));
}

/** CreateScheduleBlockDto. */
function parseBlock(body: unknown): { startsAt: string; endsAt: string; reason: string } {
  const v = new Validator(body, ['startsAt', 'endsAt', 'reason']);
  v.field('startsAt', [is.iso8601()], { type: 'string' });
  v.field('endsAt', [is.iso8601()], { type: 'string' });
  v.field('reason', text(3, 200), { type: 'string', transform: trim });
  v.done();
  return v.output as { startsAt: string; endsAt: string; reason: string };
}

// --- Rotas -----------------------------------------------------------------------

function list(request: DemoRequest): UnitView[] {
  // `includeInactive=true` só para quem administra unidades.
  const includeInactive = includeInactiveQuery(request);
  if (includeInactive && !canManageUnits(request.user)) {
    fail(403, 'FORBIDDEN', 'Só a administração vê unidades inativas.');
  }
  return state()
    .units.filter((unit) => includeInactive || unit.status === 'ACTIVE')
    .sort((a, b) => byText(a.name, b.name))
    .map(toUnitView);
}

function get(request: DemoRequest): UnitView {
  const id = parseUuid(request.params.id);
  return toUnitView(requireUnit(id, canManageUnits(request.user)));
}

function create(request: AuthedRequest): UnitView {
  const dto = parseUnitInput(request.body, false);
  const now = nowIso();
  const unit: SchedulingUnit = {
    id: uuid(),
    name: dto.name!,
    address: dto.address!,
    district: dto.district!,
    city: dto.city!,
    state: dto.state!,
    zipCode: dto.zipCode ?? null,
    phone: dto.phone ?? null,
    openingHours: dto.openingHours ?? null,
    status: dto.status ?? 'ACTIVE',
    timezone: 'America/Sao_Paulo',
    createdAt: now,
    updatedAt: now,
  };
  state().units.push(unit);
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'unit.created',
    entity: 'unit',
    entityId: unit.id,
  });
  return toUnitView(unit);
}

function update(request: AuthedRequest): UnitView {
  const id = parseUuid(request.params.id);
  const dto = parseUnitInput(request.body, true);
  const unit = requireUnit(id, true);
  if (dto.name !== undefined) unit.name = dto.name;
  if (dto.address !== undefined) unit.address = dto.address;
  if (dto.district !== undefined) unit.district = dto.district;
  if (dto.city !== undefined) unit.city = dto.city;
  if (dto.state !== undefined) unit.state = dto.state;
  // Ausente não muda; null limpa (como o Prisma com undefined/null).
  if (dto.zipCode !== undefined) unit.zipCode = dto.zipCode;
  if (dto.phone !== undefined) unit.phone = dto.phone;
  if (dto.openingHours !== undefined) unit.openingHours = dto.openingHours;
  if (dto.status !== undefined) unit.status = dto.status as UnitStatus;
  unit.updatedAt = nowIso();
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'unit.updated',
    entity: 'unit',
    entityId: id,
    metadata: {
      fields: Object.keys(dto),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    },
  });
  return toUnitView(unit);
}

function listRules(unitId: string): ScheduleRuleView[] {
  return state()
    .rules.filter((rule) => rule.unitId === unitId)
    .sort((a, b) => a.weekday - b.weekday || byText(a.startTime, b.startTime))
    .map(toRuleView);
}

function rules(request: AuthedRequest): ScheduleRuleView[] {
  const unitId = parseUuid(request.params.id);
  requireUnit(unitId, true);
  return listRules(unitId);
}

/**
 * Substitui a grade semanal. Vagas já materializadas (com reservas) mantêm a
 * capacidade com que foram criadas; os agendamentos existentes não mudam.
 */
function replaceRules(request: AuthedRequest): ScheduleRuleView[] {
  const unitId = parseUuid(request.params.id);
  const input = parseRules(request.body);
  requireUnit(unitId, true);
  const issues = validateRules(input);
  if (issues.length > 0) {
    fail(
      400,
      'INVALID_SCHEDULE_RULES',
      'Alguns períodos da grade precisam de correção.',
      'Grade inválida',
      issues.map((issue) => ({
        field: `rules.${issue.index}.${issue.field}`,
        message: issue.message,
      })),
    );
  }
  const scheduling = state();
  scheduling.rules = [
    ...scheduling.rules.filter((rule) => rule.unitId !== unitId),
    ...input.map((rule) => ({ ...rule, id: uuid(), unitId })),
  ];
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'unit.schedule_rules_replaced',
    entity: 'unit',
    entityId: unitId,
    metadata: { rules: input.length },
  });
  return listRules(unitId);
}

function blocks(request: AuthedRequest): ScheduleBlockView[] {
  const unitId = parseUuid(request.params.id);
  requireUnit(unitId, true);
  const now = Date.now();
  return state()
    .blocks.filter((block) => block.unitId === unitId && Date.parse(block.endsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map(toBlockView);
}

/**
 * Bloqueia um período (RF53): novos agendamentos ficam impedidos e os já
 * marcados no período (que ainda não começaram) são cancelados pela unidade,
 * com aviso ao doador (evento scheduling.appointment.cancelled) e a vaga liberada.
 */
function createBlock(request: AuthedRequest): ScheduleBlockView {
  const unitId = parseUuid(request.params.id);
  const dto = parseBlock(request.body);
  const unit = requireUnit(unitId, true);
  const startsAt = new Date(dto.startsAt);
  const endsAt = new Date(dto.endsAt);
  if (startsAt >= endsAt) {
    fail(400, 'INVALID_PERIOD', 'O fim do bloqueio precisa ser depois do início.', undefined, [
      { field: 'endsAt', message: 'O fim precisa ser depois do início.' },
    ]);
  }
  if (endsAt.getTime() <= Date.now()) {
    fail(400, 'INVALID_PERIOD', 'O bloqueio precisa terminar no futuro.', undefined, [
      { field: 'endsAt', message: 'O bloqueio precisa terminar no futuro.' },
    ]);
  }
  return transaction(() => {
    const now = nowIso();
    const block = {
      id: uuid(),
      unitId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: dto.reason,
      createdById: request.user.id,
      createdAt: now,
    };
    state().blocks.push(block);
    // Só o que ainda vai acontecer: horário que já passou fica para a rotina de
    // faltas (não é cancelamento da unidade nem gera aviso ao doador).
    const from = Math.max(startsAt.getTime(), Date.now());
    const affected = state().appointments.filter(
      (appointment) =>
        appointment.unitId === unitId &&
        isOpen(appointment.status) &&
        Date.parse(appointment.startsAt) < endsAt.getTime() &&
        Date.parse(appointment.startsAt) >= from,
    );
    for (const appointment of affected) {
      appointment.status = 'CANCELLED';
      appointment.cancelledAt = now;
      appointment.cancelledBy = 'STAFF';
      appointment.cancelReason = `Período bloqueado pela unidade: ${dto.reason}`;
      appointment.updatedAt = now;
      releaseSlot(appointment.slotId);
      publish<AppointmentCancelledData>(EVENTS.APPOINTMENT_CANCELLED, {
        appointmentId: appointment.id,
        donorId: appointment.donorId,
        unitName: unit.name,
        startsAt: appointment.startsAt,
        cancelledBy: 'STAFF',
      });
      recordAudit(SERVICE, {
        actor: request.user,
        action: 'appointment.cancelled',
        entity: 'appointment',
        entityId: appointment.id,
        metadata: { cancelledBy: 'STAFF', reason: 'unit_blocked', blockId: block.id },
      });
    }
    recordAudit(SERVICE, {
      actor: request.user,
      action: 'unit.block_created',
      entity: 'schedule_block',
      entityId: block.id,
      metadata: { unitId, cancelledAppointments: affected.length },
    });
    return { ...toBlockView(block), cancelledAppointments: affected.length };
  });
}

function deleteBlock(request: AuthedRequest) {
  const unitId = parseUuid(request.params.id);
  const blockId = parseUuid(request.params.blockId);
  const scheduling = state();
  const block = scheduling.blocks.find((candidate) => candidate.id === blockId);
  if (!block || block.unitId !== unitId) {
    fail(404, 'BLOCK_NOT_FOUND', 'Bloqueio não encontrado.');
  }
  scheduling.blocks = scheduling.blocks.filter((candidate) => candidate.id !== blockId);
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'unit.block_deleted',
    entity: 'schedule_block',
    entityId: blockId,
    metadata: { unitId },
  });
  return noContent();
}

export function registerUnitRoutes(): void {
  route('GET', '/units', list, { auth: 'public' });
  route('GET', '/units/:id', get, { auth: 'public' });
  route('POST', '/units', create, { permissions: ['unit:manage'] });
  route('PATCH', '/units/:id', update, { permissions: ['unit:manage'] });
  route('GET', '/units/:id/schedule-rules', rules, { permissions: ['schedule:manage'] });
  route('PUT', '/units/:id/schedule-rules', replaceRules, { permissions: ['schedule:manage'] });
  route('GET', '/units/:id/blocks', blocks, { permissions: ['schedule:manage'] });
  route('POST', '/units/:id/blocks', createBlock, { permissions: ['schedule:manage'] });
  route('DELETE', '/units/:id/blocks/:blockId', deleteBlock, {
    permissions: ['schedule:manage'],
  });
}

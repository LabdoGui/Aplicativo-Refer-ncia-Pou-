/**
 * Agenda do dia da equipe da unidade e administração de agendamentos
 * (agenda/agenda.controller.ts, agenda.service.ts e admin/admin-appointments.*).
 */
import {
  APPOINTMENT_STATUSES,
  hasPermission,
  type AdminAppointmentItem,
  type AgendaResponse,
  type AppointmentStatus,
  type AuthUser,
  type Paginated,
  type StaffAppointmentView,
} from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { fail, noContent, route, type AuthedRequest } from '../../core/http';
import {
  assertUnitScope,
  localDayRange,
  nowIso,
  todayLocal,
  toLocalDate,
} from '../../core/support';
import { cancelByStaff } from './appointments';
import {
  APPOINTMENT_NOT_FOUND,
  DEMO_EARLY_CHECK_IN,
  SERVICE,
  UNIT_NOT_FOUND,
  byText,
  donorSummaries,
  donorSummary,
  emptyStatusCounts,
  findAppointment,
  findUnit,
  isOpen,
  state,
  toAgendaItem,
  unitOf,
  type SchedulingAppointment,
} from './model';
import {
  DATE_ONLY,
  DATE_ONLY_MESSAGE,
  Validator,
  is,
  parseUuid,
  queryObject,
  toNumber,
  trim,
} from './validation';

function findInScope(user: AuthUser, id: string): SchedulingAppointment {
  const appointment = findAppointment(id);
  if (!appointment) APPOINTMENT_NOT_FOUND();
  assertUnitScope(user, appointment.unitId);
  return appointment;
}

function toStaffView(user: AuthUser, appointment: SchedulingAppointment): StaffAppointmentView {
  const summary = donorSummary(appointment.donorId);
  // Tipo sanguíneo autodeclarado é dado de saúde: só para quem faz triagem e
  // registra a doação (enfermagem), não para o colaborador nem a administração.
  const visible = hasPermission(user.role, 'screening:perform')
    ? summary
    : { ...summary, declaredBloodType: null };
  const unit = unitOf(appointment);
  return {
    ...toAgendaItem(appointment, visible),
    unit: { id: unit.id, name: unit.name },
    donorSummary: visible,
    earlyCheckInAllowed: DEMO_EARLY_CHECK_IN,
  };
}

/** Agendamentos de uma unidade num dia (AgendaQueryDto). */
function agenda(request: AuthedRequest): AgendaResponse {
  const v = new Validator(queryObject(request.query), ['unitId', 'date']);
  const unitId = v.field('unitId', [is.uuid()]) as string;
  const queryDate = v.field('date', [is.iso8601(), is.matches(DATE_ONLY, DATE_ONLY_MESSAGE)], {
    optional: true,
  }) as string | undefined;
  v.done();

  assertUnitScope(request.user, unitId);
  const unit = findUnit(unitId);
  if (!unit) UNIT_NOT_FOUND();
  const date = queryDate ?? todayLocal(unit.timezone);
  const { start, end } = localDayRange(date, date, unit.timezone);
  const appointments = state()
    .appointments.filter((appointment) => {
      const time = Date.parse(appointment.startsAt);
      return appointment.unitId === unit.id && time >= start.getTime() && time <= end.getTime();
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || byText(a.code, b.code));
  const summaries = donorSummaries(appointments.map((appointment) => appointment.donorId));
  const counts = emptyStatusCounts();
  for (const appointment of appointments) counts[appointment.status] += 1;
  return {
    unit: { id: unit.id, name: unit.name },
    date,
    items: appointments.map((appointment) =>
      toAgendaItem(appointment, summaries.get(appointment.donorId)),
    ),
    counts,
    earlyCheckInAllowed: DEMO_EARLY_CHECK_IN,
  };
}

function staffView(request: AuthedRequest): StaffAppointmentView {
  const id = parseUuid(request.params.id);
  return toStaffView(request.user, findInScope(request.user, id));
}

/**
 * Check-in só no dia do agendamento (no fuso da unidade). Com
 * DEMO_EARLY_CHECK_IN, também de dias futuros (demonstração da jornada).
 */
function checkIn(request: AuthedRequest): StaffAppointmentView {
  const id = parseUuid(request.params.id);
  const appointment = findInScope(request.user, id);
  if (!isOpen(appointment.status)) {
    fail(409, 'INVALID_STATUS', 'Este agendamento não está aguardando check-in.');
  }
  const zone = unitOf(appointment).timezone;
  const appointmentDay = toLocalDate(appointment.startsAt, zone);
  const today = todayLocal(zone);
  const early = appointmentDay > today;
  if (appointmentDay < today || (early && !DEMO_EARLY_CHECK_IN)) {
    fail(422, 'CHECK_IN_NOT_TODAY', 'O check-in só pode ser feito no dia do agendamento.');
  }
  const now = nowIso();
  appointment.status = 'CHECKED_IN';
  appointment.checkedInAt = now;
  appointment.checkedInById = request.user.id;
  appointment.updatedAt = now;
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'appointment.checked_in',
    entity: 'appointment',
    entityId: id,
    metadata: early ? { earlyCheckIn: true } : undefined,
  });
  return toStaffView(request.user, appointment);
}

/** Falta: só depois do horário marcado. A vaga não é devolvida (o horário já passou). */
function noShow(request: AuthedRequest): StaffAppointmentView {
  const id = parseUuid(request.params.id);
  const appointment = findInScope(request.user, id);
  if (!isOpen(appointment.status)) {
    fail(409, 'INVALID_STATUS', 'Só é possível registrar falta de agendamentos em aberto.');
  }
  if (Date.parse(appointment.startsAt) > Date.now()) {
    fail(422, 'NOT_STARTED', 'Só é possível registrar falta depois do horário agendado.');
  }
  const now = nowIso();
  appointment.status = 'NO_SHOW';
  appointment.noShowAt = now;
  appointment.updatedAt = now;
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'appointment.no_show',
    entity: 'appointment',
    entityId: id,
  });
  return toStaffView(request.user, appointment);
}

// --- Administração ---------------------------------------------------------------

/** Agendamentos de todas as unidades (AdminAppointmentsQueryDto: filtros e paginação). */
function adminList(request: AuthedRequest): Paginated<AdminAppointmentItem> {
  const v = new Validator(queryObject(request.query), [
    'page',
    'pageSize',
    'unitId',
    'status',
    'from',
    'to',
  ]);
  const date = [is.iso8601(), is.matches(DATE_ONLY, DATE_ONLY_MESSAGE)];
  // Campos do DTO antes dos herdados de PaginationQueryDto (ordem dos erros do class-validator).
  const unitId = v.field('unitId', [is.uuid()], { optional: true }) as string | undefined;
  const status = v.field('status', [is.in(APPOINTMENT_STATUSES)], { optional: true }) as
    AppointmentStatus | undefined;
  const from = v.field('from', date, { optional: true }) as string | undefined;
  const to = v.field('to', date, { optional: true }) as string | undefined;
  const page = v.field('page', [is.int(), is.min(1)], { optional: true, transform: toNumber });
  const pageSize = v.field('pageSize', [is.int(), is.min(1), is.max(100)], {
    optional: true,
    transform: toNumber,
  });
  v.done();

  const currentPage = (page as number | undefined) ?? 1;
  const size = (pageSize as number | undefined) ?? 20;
  if (from && to && from > to) {
    fail(400, 'INVALID_PERIOD', 'A data inicial deve ser anterior à final.');
  }
  const start = from ? localDayRange(from, from).start.getTime() : null;
  const end = to ? localDayRange(to, to).end.getTime() : null;
  const rows = state()
    .appointments.filter((appointment) => {
      const time = Date.parse(appointment.startsAt);
      return (
        (!unitId || appointment.unitId === unitId) &&
        (!status || appointment.status === status) &&
        (start === null || time >= start) &&
        (end === null || time <= end)
      );
    })
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  const pageRows = rows.slice((currentPage - 1) * size, currentPage * size);
  const summaries = donorSummaries(pageRows.map((row) => row.donorId));
  return {
    items: pageRows.map((row) => {
      const unit = unitOf(row);
      return {
        ...toAgendaItem(row, summaries.get(row.donorId)),
        unit: { id: unit.id, name: unit.name },
        cancelledBy: row.cancelledBy,
      };
    }),
    total: rows.length,
    page: currentPage,
    pageSize: size,
  };
}

/** Cancelar pela unidade (motivo obrigatório; o doador é notificado). */
function adminCancel(request: AuthedRequest) {
  const id = parseUuid(request.params.id);
  const v = new Validator(request.body, ['reason']);
  const reason = v.field('reason', [is.string(), is.minLength(3), is.maxLength(200)], {
    type: 'string',
    transform: trim,
  }) as string;
  v.done();
  cancelByStaff(request.user, id, reason);
  return noContent();
}

export function registerAgendaRoutes(): void {
  route('GET', '/agenda', agenda, { permissions: ['agenda:read'] });
  route('GET', '/agenda/appointments/:id', staffView, { permissions: ['agenda:read'] });
  route('PATCH', '/appointments/:id/check-in', checkIn, {
    permissions: ['appointment:check-in'],
  });
  route('PATCH', '/appointments/:id/no-show', noShow, { permissions: ['appointment:check-in'] });
  route('GET', '/admin/appointments', adminList, { permissions: ['appointment:manage'] });
  route('PATCH', '/admin/appointments/:id/cancel', adminCancel, {
    permissions: ['appointment:manage'],
  });
}

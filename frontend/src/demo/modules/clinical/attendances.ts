/**
 * Atendimento = triagem profissional (espelho de attendances/*). A validação dos
 * valores é a mesma do back-end (field-validation.ts, importada daqui).
 */
import {
  EVENTS,
  SCREENING_RESULTS,
  type AttendanceCompletedData,
  type AttendanceStaffView,
  type AuthUser,
  type ScreeningFieldView,
  type ScreeningResult,
  type SharedPreScreeningView,
} from '@pulso/contracts';
import {
  validateFieldValues,
  type FieldDefinition,
} from '@backend/services/clinical/src/attendances/field-validation';
import { recordAudit } from '../../core/audit';
import { publish } from '../../core/events';
import { fail, noContent, route, type AuthedRequest } from '../../core/http';
import { assertUnitScope, todayLocal, toLocalDate, uuid } from '../../core/support';
import { sharedForStaff } from './pre-screening';
import { schedulingAppointment } from './scheduling-client';
import { clinical, SERVICE, type ClinicalAttendance, type ClinicalField } from './state';
import {
  asString,
  assertCanWrite,
  bodyOf,
  Checker,
  trim,
  UNPROCESSABLE_TITLE,
  uuidParam,
} from './validation';

// --- Mapeadores (attendances/mappers.ts) --------------------------------------

export function toFieldView(field: ClinicalField): ScreeningFieldView {
  return {
    id: field.id,
    code: field.code,
    label: field.label,
    type: field.type,
    unit: field.unit,
    options: field.options,
    helpText: field.helpText,
    required: field.required,
    min: field.min,
    max: field.max,
    order: field.order,
    active: field.active,
  };
}

function toFieldDefinition(field: ClinicalField): FieldDefinition {
  return {
    code: field.code,
    label: field.label,
    type: field.type,
    options: field.options,
    required: field.required,
    min: field.min,
    max: field.max,
  };
}

export function donationOf(attendanceId: string) {
  return clinical().donations.find((donation) => donation.attendanceId === attendanceId) ?? null;
}

export function toAttendanceStaffView(attendance: ClinicalAttendance): AttendanceStaffView {
  const donation = donationOf(attendance.id);
  return {
    id: attendance.id,
    appointmentId: attendance.appointmentId,
    donorId: attendance.donorId,
    unitId: attendance.unitId,
    result: attendance.result,
    professionalName: attendance.professionalName,
    createdAt: attendance.createdAt,
    donation: donation ? { id: donation.id, code: donation.code, status: donation.status } : null,
    completed: attendance.completedAt !== null,
  };
}

/** Ordem do back-end: orderBy [{ order: 'asc' }, { label: 'asc' }]. */
export function sortFields(fields: ClinicalField[]): ClinicalField[] {
  return [...fields].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'));
}

// --- Serviço ------------------------------------------------------------------

function activeFields(): ScreeningFieldView[] {
  return sortFields(clinical().fields.filter((field) => field.active)).map(toFieldView);
}

/** Atendimento do agendamento, ou 204 se a triagem ainda não foi registrada. */
function byAppointment(actor: AuthUser, appointmentId: string) {
  const attendance = clinical().attendances.find((a) => a.appointmentId === appointmentId);
  if (attendance) {
    assertUnitScope(actor, attendance.unitId);
    const view = toAttendanceStaffView(attendance);
    // Dado de saúde só durante o atendimento (ou no mesmo dia em que terminou),
    // com leitura registrada; atendimentos antigos mostram apenas que terminaram.
    const open =
      attendance.completedAt === null || toLocalDate(attendance.completedAt) === todayLocal();
    if (!open) return { ...view, result: null, professionalName: null };
    recordAudit(SERVICE, {
      actor,
      action: 'attendance.viewed_by_staff',
      entity: 'attendance',
      entityId: attendance.id,
      metadata: { appointmentId },
    });
    return view;
  }
  const appointment = schedulingAppointment(appointmentId);
  assertUnitScope(actor, appointment.unitId);
  return noContent();
}

/**
 * Pré-triagem compartilhada pelo doador do agendamento (acesso auditado). Só
 * enquanto o atendimento está em aberto: no dia do agendamento ou depois do
 * check-in, e antes de o atendimento terminar.
 */
function sharedPreScreening(actor: AuthUser, appointmentId: string) {
  const appointment = schedulingAppointment(appointmentId);
  assertUnitScope(actor, appointment.unitId);
  const scheduledToday =
    (appointment.status === 'BOOKED' || appointment.status === 'CONFIRMED') &&
    toLocalDate(appointment.startsAt) === todayLocal();
  const open = appointment.status === 'CHECKED_IN' || scheduledToday;
  const finished = clinical().attendances.some(
    (attendance) => attendance.appointmentId === appointmentId && attendance.completedAt !== null,
  );
  if (!open || finished) {
    fail(
      409,
      'PRESCREENING_NOT_AVAILABLE',
      'A pré-triagem compartilhada fica disponível só no dia do atendimento, enquanto ele está em aberto.',
    );
  }
  const view: SharedPreScreeningView | null = sharedForStaff(
    appointment.donorId,
    appointment.startsAt,
  );
  if (!view) return noContent();
  recordAudit(SERVICE, {
    actor,
    action: 'prescreening.viewed_by_staff',
    entity: 'pre_screening',
    entityId: view.id,
    metadata: { appointmentId },
  });
  return view;
}

function alreadyRecorded(): never {
  return fail(
    409,
    'ATTENDANCE_EXISTS',
    'A triagem deste agendamento já foi registrada. Atualize a página.',
  );
}

function record(actor: AuthUser, input: unknown): AttendanceStaffView {
  const body = bodyOf(input);
  const check = new Checker(body, ['appointmentId', 'values', 'result', 'notes']);
  const appointmentId = asString(body.appointmentId);
  const result = asString(body.result);
  const notes = trim(asString(body.notes));
  check.uuidV4('appointmentId', appointmentId);
  check.object('values', body.values);
  check.oneOf('result', result, SCREENING_RESULTS);
  if (notes !== undefined && notes !== null) check.string('notes', notes, { max: 1000 });
  check.done();
  const dto = {
    appointmentId: appointmentId as string,
    values: body.values as Record<string, unknown>,
    result: result as ScreeningResult,
    notes: typeof notes === 'string' ? notes : undefined,
  };

  const appointment = schedulingAppointment(dto.appointmentId);
  assertUnitScope(actor, appointment.unitId);
  if (appointment.status !== 'CHECKED_IN') {
    fail(
      422,
      'APPOINTMENT_NOT_CHECKED_IN',
      'Faça o check-in do doador antes de registrar a triagem.',
      UNPROCESSABLE_TITLE,
    );
  }
  const state = clinical();
  if (state.attendances.some((a) => a.appointmentId === dto.appointmentId)) alreadyRecorded();

  const fields = state.fields.filter((field) => field.active);
  const { values, errors } = validateFieldValues(fields.map(toFieldDefinition), dto.values);
  if (errors.length > 0) {
    fail(
      400,
      'VALIDATION_ERROR',
      'Alguns campos da triagem precisam de correção.',
      'Dados inválidos',
      errors,
    );
  }

  const now = new Date().toISOString();
  // Sem aptidão, não há doação a registrar: o atendimento termina aqui.
  const completesNow = dto.result !== 'FIT';
  const created: ClinicalAttendance = {
    id: uuid(),
    appointmentId: appointment.id,
    donorId: appointment.donorId,
    unitId: appointment.unitId,
    unitName: appointment.unitName,
    campaignId: appointment.campaignId,
    campaignTitle: appointment.campaignTitle,
    professionalId: actor.id,
    professionalName: actor.name,
    result: dto.result,
    values,
    notes: dto.notes ? dto.notes : null,
    completedAt: completesNow ? now : null,
    createdAt: now,
  };
  state.attendances.push(created);
  if (completesNow) {
    publish<AttendanceCompletedData>(EVENTS.ATTENDANCE_COMPLETED, {
      attendanceId: created.id,
      appointmentId: created.appointmentId,
      donorId: created.donorId,
      unitId: created.unitId,
      donationCompleted: false,
      donationId: null,
      campaignId: created.campaignId,
      occurredAt: now,
    });
  }
  // Sem o resultado: a trilha registra o fato, não o dado de saúde.
  recordAudit(SERVICE, {
    actor,
    action: 'attendance.screening_recorded',
    entity: 'attendance',
    entityId: created.id,
    metadata: { appointmentId: appointment.id },
  });
  return toAttendanceStaffView(created);
}

export function registerAttendances(): void {
  const perform = { permissions: ['screening:perform' as const] };
  route('GET', '/attendances/fields', () => activeFields(), perform);
  route(
    'GET',
    '/attendances/appointment/:appointmentId',
    (request) => byAppointment(request.user, uuidParam(request.params.appointmentId)),
    perform,
  );
  route(
    'GET',
    '/attendances/appointment/:appointmentId/pre-screening',
    (request) => sharedPreScreening(request.user, uuidParam(request.params.appointmentId)),
    { permissions: ['prescreening:read-shared'] },
  );
  route(
    'POST',
    '/attendances',
    (request: AuthedRequest) => {
      assertCanWrite(request.user);
      return record(request.user, request.body);
    },
    perform,
  );
}

/**
 * Integração com os outros serviços: eventos consumidos
 * (events/attendance-completed.handler.ts e user-deleted.handler.ts) e as
 * rotas internas (internal/internal.controller.ts).
 */
import {
  EVENTS,
  type AttendanceCompletedData,
  type InternalAppointmentView,
  type SchedulingStats,
  type StatsFilters,
  type UserDeletedData,
} from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { subscribe } from '../../core/events';
import { internal } from '../../core/internal';
import { eachLocalDay, inRange, nowIso, statsRange, toLocalDate } from '../../core/support';
import { UNFINISHED_REASON } from './jobs';
import { releaseSlot } from './ledger';
import {
  APPOINTMENT_NOT_FOUND,
  SERVICE,
  emptyStatusCounts,
  findAppointment,
  findCampaign,
  isOpen,
  state,
  unitOf,
} from './model';

/**
 * Atendimento finalizado no clinical (com ou sem doação) → agendamento
 * concluído. Idempotente: só altera agendamentos ainda em aberto, ou os que o
 * sistema encerrou por terem ficado com check-in sem atendimento finalizado no
 * dia (a enfermagem finalizou depois).
 */
function onAttendanceCompleted(data: AttendanceCompletedData): void {
  if (!data.appointmentId) return;
  const appointment = findAppointment(data.appointmentId);
  if (!appointment) return;
  const pending = isOpen(appointment.status) || appointment.status === 'CHECKED_IN';
  const closedBySystem =
    appointment.status === 'CANCELLED' &&
    appointment.cancelledBy === 'SYSTEM' &&
    appointment.checkedInAt !== null &&
    appointment.cancelReason === UNFINISHED_REASON;
  if (!pending && !closedBySystem) return;
  appointment.status = 'COMPLETED';
  appointment.completedAt = new Date(data.occurredAt).toISOString();
  appointment.cancelledAt = null;
  appointment.cancelledBy = null;
  appointment.cancelReason = null;
  appointment.updatedAt = nowIso();
}

/**
 * Conta excluída (LGPD) → agendamentos ainda não atendidos são cancelados pelo
 * sistema e as vagas voltam para a agenda. O histórico já atendido fica, ligado
 * só ao identificador. Sem notificação: a conta não existe mais.
 */
function onUserDeleted(data: UserDeletedData): void {
  const open = state().appointments.filter(
    (appointment) => appointment.donorId === data.userId && isOpen(appointment.status),
  );
  for (const appointment of open) {
    const now = nowIso();
    appointment.status = 'CANCELLED';
    appointment.cancelledAt = now;
    appointment.cancelledBy = 'SYSTEM';
    appointment.cancelReason = 'Conta excluída pelo titular.';
    appointment.updatedAt = now;
    releaseSlot(appointment.slotId);
    recordAudit(SERVICE, {
      actor: null,
      action: 'appointment.cancelled',
      entity: 'appointment',
      entityId: appointment.id,
      metadata: { cancelledBy: 'SYSTEM', reason: 'account_deleted' },
    });
  }
}

/** GET /internal/appointments/:id — usado pelo clinical ao registrar a triagem. */
function internalAppointment(id: string): InternalAppointmentView {
  const appointment = findAppointment(id);
  if (!appointment) APPOINTMENT_NOT_FOUND();
  return {
    id: appointment.id,
    code: appointment.code,
    donorId: appointment.donorId,
    unitId: appointment.unitId,
    unitName: unitOf(appointment).name,
    status: appointment.status,
    startsAt: appointment.startsAt,
    campaignId: appointment.campaignId,
    campaignTitle: findCampaign(appointment.campaignId)?.title ?? null,
  };
}

/** GET /internal/stats — indicadores de agendamento por período (dashboard). */
function internalStats(filters: StatsFilters): SchedulingStats {
  const range = statsRange(filters);
  const scheduling = state();
  const ofUnit = scheduling.appointments.filter(
    (appointment) => !filters.unitId || appointment.unitId === filters.unitId,
  );
  const appointments = ofUnit.filter((appointment) => inRange(appointment.startsAt, range));
  const now = Date.now();
  const upcoming = ofUnit.filter(
    (appointment) =>
      (isOpen(appointment.status) || appointment.status === 'CHECKED_IN') &&
      Date.parse(appointment.startsAt) >= now,
  ).length;
  const activeUnits = scheduling.units.filter((unit) => unit.status === 'ACTIVE').length;

  const byStatus = emptyStatusCounts();
  const perDay = new Map<string, number>();
  for (const appointment of appointments) {
    byStatus[appointment.status] += 1;
    const day = toLocalDate(appointment.startsAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const attended = byStatus.COMPLETED;
  const decided = attended + byStatus.NO_SHOW;
  return {
    appointmentsTotal: appointments.length,
    byStatus,
    byDay: eachLocalDay(filters.from, filters.to).map((date) => ({
      date,
      count: perDay.get(date) ?? 0,
    })),
    attendanceRate: decided > 0 ? Math.round((attended / decided) * 1000) / 1000 : null,
    upcoming,
    activeUnits,
  };
}

export function registerIntegration(): void {
  subscribe<AttendanceCompletedData>(
    EVENTS.ATTENDANCE_COMPLETED,
    'complete-appointment',
    onAttendanceCompleted,
  );
  subscribe<UserDeletedData>(EVENTS.USER_DELETED, 'cancel-open-appointments', onUserDeleted);
  internal.scheduling.appointment = internalAppointment;
  internal.scheduling.stats = internalStats;
}

/**
 * Rotinas periódicas do scheduling-service: agendamentos vencidos
 * (stale-appointments.service.ts, a cada 15 minutos) e lembretes
 * (reminders/reminder.job.ts, a cada 10 minutos). Na demonstração rodam ao
 * abrir e depois no mesmo intervalo, enquanto a página estiver aberta.
 */
import { EVENTS, type AppointmentReminderDueData } from '@pulso/contracts';
import { recordAudit } from '../../core/audit';
import { flushEvents, publish } from '../../core/events';
import { scheduleSave } from '../../core/state';
import { addDays, localDayRange, toLocalDate } from '../../core/support';
import { SERVICE, isOpen, state, unitOf } from './model';

/** Tolerância depois do fim da vaga antes de o agendamento virar falta automática. */
export const NO_SHOW_GRACE_HOURS = 2;

export const UNFINISHED_REASON = 'Atendimento não finalizado no dia do agendamento.';

/** Antecedência do lembrete. */
export const REMINDER_WINDOW_HOURS = 24;
/** Agendamentos feitos há menos disso não recebem lembrete (a confirmação acabou de chegar). */
export const REMINDER_MIN_AGE_MINUTES = 60;
const REMINDER_BATCH = 200;

/**
 * Encerra os agendamentos que ficaram para trás (de todos ou de um doador),
 * para que não prendam o doador (RN03) nem a agenda:
 *  - em aberto duas horas depois do fim da vaga → falta (a vaga não volta);
 *  - com check-in de antes de ontem, sem atendimento finalizado → cancelado
 *    pelo sistema (o dia seguinte inteiro fica livre para a triagem atrasada).
 * Devolve quantos mudaram.
 */
export function expireStaleAppointments(now: Date, donorId?: string): number {
  const nowIso = now.toISOString();
  const noShowCutoff = now.getTime() - NO_SHOW_GRACE_HOURS * 3_600_000;
  const yesterday = addDays(toLocalDate(now), -1);
  const startOfYesterday = localDayRange(yesterday, yesterday).start.getTime();

  const noShows: string[] = [];
  const unfinished: string[] = [];
  for (const appointment of state().appointments) {
    if (donorId && appointment.donorId !== donorId) continue;
    if (isOpen(appointment.status) && Date.parse(appointment.endsAt) < noShowCutoff) {
      appointment.status = 'NO_SHOW';
      appointment.noShowAt = nowIso;
      appointment.updatedAt = nowIso;
      noShows.push(appointment.id);
    }
  }
  for (const appointment of state().appointments) {
    if (donorId && appointment.donorId !== donorId) continue;
    if (
      appointment.status === 'CHECKED_IN' &&
      Date.parse(appointment.startsAt) < startOfYesterday
    ) {
      appointment.status = 'CANCELLED';
      appointment.cancelledAt = nowIso;
      appointment.cancelledBy = 'SYSTEM';
      appointment.cancelReason = UNFINISHED_REASON;
      appointment.updatedAt = nowIso;
      unfinished.push(appointment.id);
    }
  }
  for (const id of noShows) {
    recordAudit(SERVICE, {
      actor: null,
      action: 'appointment.no_show',
      entity: 'appointment',
      entityId: id,
      metadata: { automatic: true },
    });
  }
  for (const id of unfinished) {
    recordAudit(SERVICE, {
      actor: null,
      action: 'appointment.cancelled',
      entity: 'appointment',
      entityId: id,
      metadata: { cancelledBy: 'SYSTEM', reason: 'unfinished_attendance' },
    });
  }
  return noShows.length + unfinished.length;
}

/**
 * Lembretes: agendamentos em aberto que começam nas próximas 24 horas geram
 * `scheduling.appointment.reminder_due` (o notification avisa o doador), uma
 * vez só (reminderSentAt).
 */
export function sendDueReminders(now: Date): number {
  const nowMs = now.getTime();
  const due = state()
    .appointments.filter(
      (appointment) =>
        isOpen(appointment.status) &&
        appointment.reminderSentAt === null &&
        Date.parse(appointment.startsAt) > nowMs &&
        Date.parse(appointment.startsAt) <= nowMs + REMINDER_WINDOW_HOURS * 3_600_000 &&
        Date.parse(appointment.createdAt) < nowMs - REMINDER_MIN_AGE_MINUTES * 60_000,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, REMINDER_BATCH);
  for (const appointment of due) {
    appointment.reminderSentAt = now.toISOString();
    appointment.updatedAt = now.toISOString();
    publish<AppointmentReminderDueData>(EVENTS.APPOINTMENT_REMINDER_DUE, {
      appointmentId: appointment.id,
      donorId: appointment.donorId,
      unitName: unitOf(appointment).name,
      startsAt: appointment.startsAt,
    });
  }
  return due.length;
}

const STALE_INTERVAL_MS = 15 * 60_000;
const REMINDER_INTERVAL_MS = 10 * 60_000;

/** Entrega os eventos e guarda o estado depois de uma rotina fora de requisição. */
function settle(changed: number): void {
  if (changed === 0) return;
  flushEvents();
  scheduleSave();
}

let started = false;

/**
 * Roda as rotinas ao abrir (antes da primeira leitura, para a agenda já vir
 * atualizada) e agenda as próximas execuções. Os eventos da primeira rodada
 * são entregues logo depois que todos os módulos se registram.
 */
export function startJobs(): void {
  if (started) return;
  started = true;
  const opened = expireStaleAppointments(new Date()) + sendDueReminders(new Date());
  setTimeout(() => settle(opened), 0);
  setInterval(() => settle(expireStaleAppointments(new Date())), STALE_INTERVAL_MS);
  setInterval(() => settle(sendDueReminders(new Date())), REMINDER_INTERVAL_MS);
}

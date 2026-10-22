/**
 * Agendamentos do doador e disponibilidade (appointments/appointments.controller.ts,
 * appointments.service.ts e availability.service.ts).
 */
import {
  EVENTS,
  SCHEDULING_POLICY,
  type AppointmentBookedData,
  type AppointmentCancelledData,
  type AppointmentRescheduledData,
  type AppointmentView,
  type AuthUser,
  type AvailabilityResponse,
  type CancelledBy,
} from '@pulso/contracts';
import {
  bookingWindow,
  canChange,
  dayAvailability,
  findSlotForStart,
  isBlocked,
  slotsForDay,
  type GeneratedSlot,
  type SlotUsage,
} from '@backend/services/scheduling/src/domain/schedule';
import { recordAudit } from '../../core/audit';
import { publish } from '../../core/events';
import { fail, route, type AuthedRequest, type DemoRequest } from '../../core/http';
import { eachLocalDay, humanCode, localDayRange, nowIso, uuid } from '../../core/support';
import { resolveCampaignForBooking } from './campaigns';
import { expireStaleAppointments } from './jobs';
import { releaseSlot, reserveSlot } from './ledger';
import {
  APPOINTMENT_NOT_FOUND,
  SERVICE,
  UNIT_NOT_FOUND,
  findUnit,
  isOpen,
  state,
  toAppointmentView,
  transaction,
  unitOf,
  type SchedulingAppointment,
  type SchedulingUnit,
} from './model';
import {
  DATE_ONLY,
  DATE_ONLY_MESSAGE,
  Validator,
  is,
  parseUuid,
  queryObject,
  trim,
} from './validation';

/** Maior intervalo consultado de uma vez. */
export const MAX_AVAILABILITY_DAYS = 31;

function ACTIVE_APPOINTMENT(): never {
  return fail(
    409,
    'ACTIVE_APPOINTMENT_EXISTS',
    'Você já tem um agendamento ativo. Cancele ou reagende antes de marcar outro.',
  );
}

// --- Disponibilidade ---------------------------------------------------------------

/**
 * Vagas por dia, dentro da janela de agendamento (RN05). Vagas lotadas vêm
 * com `remaining = 0` (a interface mostra "lotado"); vagas bloqueadas, antes
 * da antecedência mínima ou fora da grade não aparecem.
 */
function availability(request: DemoRequest): AvailabilityResponse {
  const v = new Validator(queryObject(request.query), ['unitId', 'from', 'to']);
  const date = [is.iso8601(), is.matches(DATE_ONLY, DATE_ONLY_MESSAGE)];
  const unitId = v.field('unitId', [is.uuid()]) as string;
  const queryFrom = v.field('from', date) as string;
  const queryTo = v.field('to', date) as string;
  v.done();

  const unit = findUnit(unitId);
  if (!unit || unit.status !== 'ACTIVE') UNIT_NOT_FOUND();
  if (queryFrom > queryTo) {
    fail(400, 'INVALID_PERIOD', 'A data inicial deve ser anterior à final.');
  }
  if (eachLocalDay(queryFrom, queryTo).length > MAX_AVAILABILITY_DAYS) {
    fail(400, 'INVALID_PERIOD', `Consulte no máximo ${MAX_AVAILABILITY_DAYS} dias por vez.`);
  }

  const zone = unit.timezone;
  const window = bookingWindow(new Date(), zone);
  const from = queryFrom > window.firstDay ? queryFrom : window.firstDay;
  const to = queryTo < window.lastDay ? queryTo : window.lastDay;
  if (from > to) return { unitId: unit.id, timezone: zone, days: [] };

  const { start, end } = localDayRange(from, to, zone);
  const scheduling = state();
  const rules = scheduling.rules.filter((rule) => rule.unitId === unit.id && rule.active);
  const blocks = scheduling.blocks
    .filter(
      (block) =>
        block.unitId === unit.id &&
        Date.parse(block.startsAt) < end.getTime() &&
        Date.parse(block.endsAt) > start.getTime(),
    )
    .map((block) => ({ startsAt: new Date(block.startsAt), endsAt: new Date(block.endsAt) }));
  const usage = new Map<number, SlotUsage>();
  for (const slot of scheduling.slots) {
    const time = Date.parse(slot.startsAt);
    if (slot.unitId === unit.id && time >= start.getTime() && time <= end.getTime()) {
      usage.set(time, { bookedCount: slot.bookedCount });
    }
  }

  return {
    unitId: unit.id,
    timezone: zone,
    days: eachLocalDay(from, to).map((day) => ({
      date: day,
      slots: dayAvailability({
        generated: slotsForDay(rules, day, zone),
        blocks,
        usage,
        earliest: window.earliest,
      }),
    })),
  };
}

// --- Regras compartilhadas -----------------------------------------------------------

interface ResolvedSlot {
  unit: SchedulingUnit;
  slot: GeneratedSlot;
}

/** Valida unidade, janela (RN05), alinhamento à grade e bloqueios (RN02). */
function resolveSlot(unitId: string, startsAt: Date): ResolvedSlot {
  const unit = findUnit(unitId);
  if (!unit) UNIT_NOT_FOUND();
  if (unit.status !== 'ACTIVE') {
    fail(
      422,
      'UNIT_UNAVAILABLE',
      'Esta unidade não está recebendo agendamentos no momento. Escolha outra.',
    );
  }
  const window = bookingWindow(new Date(), unit.timezone);
  if (startsAt < window.earliest) {
    fail(
      422,
      'TOO_SOON',
      `Escolha um horário com pelo menos ${SCHEDULING_POLICY.minLeadMinutes / 60} horas de antecedência.`,
    );
  }
  if (startsAt > window.latest) {
    fail(
      422,
      'TOO_FAR',
      `É possível agendar com até ${SCHEDULING_POLICY.maxDaysAhead} dias de antecedência.`,
    );
  }
  const rules = state().rules.filter((rule) => rule.unitId === unitId && rule.active);
  const slot = findSlotForStart(rules, startsAt, unit.timezone);
  if (!slot) {
    fail(422, 'INVALID_SLOT', 'Este horário não existe na agenda desta unidade.');
  }
  const blocks = state()
    .blocks.filter(
      (block) =>
        block.unitId === unitId &&
        Date.parse(block.startsAt) < slot.endsAt.getTime() &&
        Date.parse(block.endsAt) > slot.startsAt.getTime(),
    )
    .map((block) => ({ startsAt: new Date(block.startsAt), endsAt: new Date(block.endsAt) }));
  if (isBlocked(slot, blocks)) {
    fail(422, 'SLOT_BLOCKED', 'Este horário foi bloqueado pela unidade. Escolha outro.');
  }
  return { unit, slot };
}

function uniqueCode(): string {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = humanCode('AG');
    if (!state().appointments.some((appointment) => appointment.code === code)) return code;
  }
  throw new Error('Não foi possível gerar um código de agendamento único');
}

function createAppointment(
  donorId: string,
  unit: SchedulingUnit,
  slot: GeneratedSlot,
  campaignId: string | null,
  rescheduledFromId: string | null,
): SchedulingAppointment {
  // Índice único parcial do banco: um agendamento ativo por doador (RN03).
  const hasActive = state().appointments.some(
    (appointment) =>
      appointment.donorId === donorId &&
      (isOpen(appointment.status) || appointment.status === 'CHECKED_IN'),
  );
  if (hasActive) ACTIVE_APPOINTMENT();
  const slotId = reserveSlot(unit.id, slot);
  const now = nowIso();
  const appointment: SchedulingAppointment = {
    id: uuid(),
    code: uniqueCode(),
    donorId,
    unitId: unit.id,
    slotId,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    status: 'BOOKED',
    campaignId,
    rescheduledFromId,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    checkedInAt: null,
    checkedInById: null,
    completedAt: null,
    noShowAt: null,
    reminderSentAt: null,
    createdAt: now,
    updatedAt: now,
  };
  state().appointments.push(appointment);
  return appointment;
}

interface CancelOptions {
  cancelledBy: CancelledBy;
  reason: string | null;
  actor: AuthUser;
  /** No reagendamento o evento é "rescheduled", não "cancelled". */
  emitEvent: boolean;
}

/** Cancela (só se ainda estiver em aberto), libera a vaga e registra evento e auditoria. */
function cancelAppointment(appointment: SchedulingAppointment, options: CancelOptions): void {
  if (!isOpen(appointment.status)) {
    fail(
      409,
      'INVALID_STATUS',
      'Este agendamento mudou de situação. Atualize a página e tente novamente.',
    );
  }
  const now = nowIso();
  appointment.status = 'CANCELLED';
  appointment.cancelledAt = now;
  appointment.cancelledBy = options.cancelledBy;
  appointment.cancelReason = options.reason;
  appointment.updatedAt = now;
  releaseSlot(appointment.slotId);
  if (options.emitEvent) {
    publish<AppointmentCancelledData>(EVENTS.APPOINTMENT_CANCELLED, {
      appointmentId: appointment.id,
      donorId: appointment.donorId,
      unitName: unitOf(appointment).name,
      startsAt: appointment.startsAt,
      cancelledBy: options.cancelledBy,
    });
  }
  recordAudit(SERVICE, {
    actor: options.actor,
    action: 'appointment.cancelled',
    entity: 'appointment',
    entityId: appointment.id,
    metadata: { cancelledBy: options.cancelledBy },
  });
}

/** Verificação antecipada (mensagem clara); o "índice único" garante a regra (RN03). */
function assertNoActiveAppointment(donorId: string): void {
  const active = state().appointments.some(
    (appointment) =>
      appointment.donorId === donorId &&
      (isOpen(appointment.status) || appointment.status === 'CHECKED_IN'),
  );
  if (active) ACTIVE_APPOINTMENT();
}

function assertDonorCanChange(appointment: SchedulingAppointment): void {
  if (canChange(appointment.status, new Date(appointment.startsAt), new Date())) return;
  if (!isOpen(appointment.status)) {
    fail(409, 'INVALID_STATUS', 'Este agendamento não pode mais ser alterado.');
  }
  const unit = unitOf(appointment);
  const phone = unit.phone ? ` pelo telefone ${unit.phone}` : '';
  fail(
    422,
    'CHANGE_WINDOW_CLOSED',
    `Cancelamentos e reagendamentos pelo app vão até ${SCHEDULING_POLICY.cancelMinHours} horas antes do horário. Fale com a unidade${phone}.`,
  );
}

/** Doador só enxerga os próprios agendamentos (os de outra pessoa respondem 404). */
function findOwn(donorId: string, id: string): SchedulingAppointment {
  const appointment = state().appointments.find(
    (candidate) => candidate.id === id && candidate.donorId === donorId,
  );
  if (!appointment) APPOINTMENT_NOT_FOUND();
  return appointment;
}

/** Cancelamento pela unidade/administração: vale a qualquer momento antes do atendimento. */
export function cancelByStaff(actor: AuthUser, id: string, reason: string): void {
  const appointment = state().appointments.find((candidate) => candidate.id === id);
  if (!appointment) APPOINTMENT_NOT_FOUND();
  if (!isOpen(appointment.status)) {
    fail(409, 'INVALID_STATUS', 'Este agendamento não pode mais ser cancelado.');
  }
  transaction(() =>
    cancelAppointment(appointment, { cancelledBy: 'STAFF', reason, actor, emitEvent: true }),
  );
}

// --- DTOs ------------------------------------------------------------------------

function parseBooking(body: unknown, withCampaign: boolean) {
  const v = new Validator(
    body,
    withCampaign ? ['unitId', 'startsAt', 'campaignId'] : ['unitId', 'startsAt'],
  );
  const unitId = v.field('unitId', [is.uuid()], { type: 'string' }) as string;
  const startsAt = v.field('startsAt', [is.iso8601()], { type: 'string' }) as string;
  const campaignId = withCampaign
    ? (v.field('campaignId', [is.uuid()], { optional: true, nullable: true }) as
        string | null | undefined)
    : undefined;
  v.done();
  return { unitId, startsAt, campaignId };
}

function parseCancel(body: unknown): { reason?: string } {
  const v = new Validator(body, ['reason']);
  const reason = v.field('reason', [is.string(), is.maxLength(200)], {
    optional: true,
    type: 'string',
    transform: trim,
  }) as string | undefined;
  v.done();
  return { reason: reason ?? undefined };
}

// --- Rotas -------------------------------------------------------------------------

function book(request: AuthedRequest): AppointmentView {
  const donor = request.user;
  const dto = parseBooking(request.body, true);
  const startsAt = new Date(dto.startsAt);
  const { unit, slot } = resolveSlot(dto.unitId, startsAt);
  const campaignId = resolveCampaignForBooking(dto.campaignId, unit.id, startsAt, unit.timezone);
  // Um agendamento antigo que ficou para trás não impede a nova reserva.
  expireStaleAppointments(new Date(), donor.id);
  assertNoActiveAppointment(donor.id);

  const created = transaction(() => {
    const appointment = createAppointment(donor.id, unit, slot, campaignId, null);
    publish<AppointmentBookedData>(EVENTS.APPOINTMENT_BOOKED, {
      appointmentId: appointment.id,
      code: appointment.code,
      donorId: donor.id,
      unitId: unit.id,
      unitName: unit.name,
      startsAt: appointment.startsAt,
      campaignId,
    });
    recordAudit(SERVICE, {
      actor: donor,
      action: 'appointment.booked',
      entity: 'appointment',
      entityId: appointment.id,
      metadata: { unitId: unit.id, campaignId },
    });
    return appointment;
  });
  return toAppointmentView(created);
}

function mine(request: AuthedRequest): AppointmentView[] {
  const now = new Date();
  return state()
    .appointments.filter((appointment) => appointment.donorId === request.user.id)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
    .map((appointment) => toAppointmentView(appointment, now));
}

function getMine(request: AuthedRequest): AppointmentView {
  const id = parseUuid(request.params.id);
  return toAppointmentView(findOwn(request.user.id, id));
}

function cancel(request: AuthedRequest): AppointmentView {
  const id = parseUuid(request.params.id);
  const dto = parseCancel(request.body);
  const appointment = findOwn(request.user.id, id);
  assertDonorCanChange(appointment);
  transaction(() =>
    cancelAppointment(appointment, {
      cancelledBy: 'DONOR',
      reason: dto.reason || null,
      actor: request.user,
      emitEvent: true,
    }),
  );
  return toAppointmentView(findOwn(request.user.id, id));
}

function reschedule(request: AuthedRequest): AppointmentView {
  const donor = request.user;
  const id = parseUuid(request.params.id);
  const dto = parseBooking(request.body, false);
  const previous = findOwn(donor.id, id);
  assertDonorCanChange(previous);
  const startsAt = new Date(dto.startsAt);
  if (previous.unitId === dto.unitId && Date.parse(previous.startsAt) === startsAt.getTime()) {
    fail(422, 'SAME_SLOT', 'Escolha um horário diferente do atual.');
  }
  const { unit, slot } = resolveSlot(dto.unitId, startsAt);
  // A campanha acompanha o reagendamento só se continuar valendo para a nova data/unidade.
  const campaignId = resolveCampaignForBooking(
    previous.campaignId,
    unit.id,
    startsAt,
    unit.timezone,
    true,
  );

  const created = transaction(() => {
    cancelAppointment(previous, {
      cancelledBy: 'DONOR',
      reason: 'Reagendado pelo doador',
      actor: donor,
      emitEvent: false,
    });
    const appointment = createAppointment(donor.id, unit, slot, campaignId, previous.id);
    publish<AppointmentRescheduledData>(EVENTS.APPOINTMENT_RESCHEDULED, {
      appointmentId: appointment.id,
      previousAppointmentId: previous.id,
      donorId: donor.id,
      unitName: unit.name,
      startsAt: appointment.startsAt,
    });
    recordAudit(SERVICE, {
      actor: donor,
      action: 'appointment.rescheduled',
      entity: 'appointment',
      entityId: appointment.id,
      metadata: { previousAppointmentId: previous.id, unitId: unit.id, campaignId },
    });
    return appointment;
  });
  return toAppointmentView(created);
}

export function registerAppointmentRoutes(): void {
  // Rotas fixas antes de ":id".
  route('GET', '/appointments/availability', availability, { auth: 'public' });
  route('GET', '/appointments/me', mine, { permissions: ['self:appointments'] });
  route('POST', '/appointments', book, { permissions: ['self:appointments'] });
  route('GET', '/appointments/:id', getMine, { permissions: ['self:appointments'] });
  route('PATCH', '/appointments/:id/cancel', cancel, { permissions: ['self:appointments'] });
  route('PATCH', '/appointments/:id/reschedule', reschedule, {
    permissions: ['self:appointments'],
  });
}

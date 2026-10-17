/**
 * Regras puras da grade de horários: geração de vagas a partir das regras
 * semanais (hora local da unidade), alinhamento de um horário pedido, janela
 * de agendamento (RN05), prazo de alteração pelo doador (RN06) e cálculo da
 * disponibilidade. Sem acesso a banco, para ser testável isoladamente.
 */
import { DateTime } from 'luxon';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  SCHEDULING_POLICY,
  type AppointmentStatus,
  type AvailabilitySlot,
} from '@pulso/contracts';

export interface RuleLike {
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacity: number;
  active: boolean;
}

export interface Period {
  startsAt: Date;
  endsAt: Date;
}

export interface GeneratedSlot extends Period {
  capacity: number;
}

/** "HH:mm" → minutos desde a meia-noite. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Vagas de um dia local (AAAA-MM-DD) geradas pelas regras ativas daquele dia da semana. */
export function slotsForDay(rules: RuleLike[], date: string, zone: string): GeneratedSlot[] {
  const day = DateTime.fromISO(date, { zone }).startOf('day');
  if (!day.isValid) return [];
  const slots: GeneratedSlot[] = [];
  for (const rule of rules) {
    if (!rule.active || rule.weekday !== day.weekday || rule.slotMinutes <= 0) continue;
    const end = timeToMinutes(rule.endTime);
    for (
      let start = timeToMinutes(rule.startTime);
      start + rule.slotMinutes <= end;
      start += rule.slotMinutes
    ) {
      const startsAt = day.plus({ minutes: start });
      slots.push({
        startsAt: startsAt.toJSDate(),
        endsAt: startsAt.plus({ minutes: rule.slotMinutes }).toJSDate(),
        capacity: rule.capacity,
      });
    }
  }
  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Vaga da grade que começa exatamente em `startsAt` (null se o horário não existe). */
export function findSlotForStart(
  rules: RuleLike[],
  startsAt: Date,
  zone: string,
): GeneratedSlot | null {
  const local = DateTime.fromJSDate(startsAt).setZone(zone);
  if (!local.isValid) return null;
  return (
    slotsForDay(rules, local.toISODate()!, zone).find(
      (slot) => slot.startsAt.getTime() === startsAt.getTime(),
    ) ?? null
  );
}

export function overlaps(a: Period, b: Period): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function isBlocked(slot: Period, blocks: Period[]): boolean {
  return blocks.some((block) => overlaps(slot, block));
}

/** Janela de agendamento (RN05): antecedência mínima até o fim do último dia permitido. */
export function bookingWindow(
  now: Date,
  zone: string,
): { earliest: Date; latest: Date; firstDay: string; lastDay: string } {
  const local = DateTime.fromJSDate(now).setZone(zone);
  const earliest = local.plus({ minutes: SCHEDULING_POLICY.minLeadMinutes });
  const last = local.plus({ days: SCHEDULING_POLICY.maxDaysAhead }).endOf('day');
  return {
    earliest: earliest.toJSDate(),
    latest: last.toJSDate(),
    firstDay: local.toISODate()!,
    lastDay: last.toISODate()!,
  };
}

/** RN06: o doador altera (cancela ou reagenda) até X horas antes do horário. */
export function canChange(status: AppointmentStatus, startsAt: Date, now: Date): boolean {
  if (status !== 'BOOKED' && status !== 'CONFIRMED') return false;
  return startsAt.getTime() - now.getTime() >= SCHEDULING_POLICY.cancelMinHours * 3_600_000;
}

export function isActiveStatus(status: AppointmentStatus): boolean {
  return ACTIVE_APPOINTMENT_STATUSES.includes(status);
}

export interface SlotUsage {
  capacity: number;
  bookedCount: number;
}

/**
 * Disponibilidade de um dia: vagas da grade a partir de `earliest`, sem as
 * bloqueadas, com as vagas restantes de cada uma. Vagas lotadas continuam na
 * lista (remaining = 0) para a interface mostrar "lotado".
 */
export function dayAvailability(params: {
  generated: GeneratedSlot[];
  blocks: Period[];
  usage: Map<number, SlotUsage>;
  earliest: Date;
}): AvailabilitySlot[] {
  return params.generated
    .filter((slot) => slot.startsAt >= params.earliest && !isBlocked(slot, params.blocks))
    .map((slot) => {
      const used = params.usage.get(slot.startsAt.getTime());
      const capacity = used?.capacity ?? slot.capacity;
      return {
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        capacity,
        remaining: Math.max(0, capacity - (used?.bookedCount ?? 0)),
      };
    });
}

export interface RuleIssue {
  index: number;
  field: 'startTime' | 'endTime' | 'slotMinutes';
  message: string;
}

/**
 * Consistência das regras de uma unidade: início antes do fim, duração da vaga
 * dividindo a janela e nenhuma sobreposição no mesmo dia da semana.
 */
export function validateRules(rules: RuleLike[]): RuleIssue[] {
  const issues: RuleIssue[] = [];
  rules.forEach((rule, index) => {
    const start = timeToMinutes(rule.startTime);
    const end = timeToMinutes(rule.endTime);
    if (start >= end) {
      issues.push({ index, field: 'endTime', message: 'O fim precisa ser depois do início.' });
      return;
    }
    if ((end - start) % rule.slotMinutes !== 0) {
      issues.push({
        index,
        field: 'slotMinutes',
        message: 'A duração da vaga precisa dividir o período sem sobras.',
      });
    }
    const clash = rules.findIndex(
      (other, otherIndex) =>
        otherIndex < index &&
        other.weekday === rule.weekday &&
        timeToMinutes(other.startTime) < end &&
        start < timeToMinutes(other.endTime),
    );
    if (clash >= 0) {
      issues.push({
        index,
        field: 'startTime',
        message: `Este período se sobrepõe a outro do mesmo dia (regra ${clash + 1}).`,
      });
    }
  });
  return issues;
}

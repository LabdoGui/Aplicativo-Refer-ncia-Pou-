/**
 * Porte de seed/seed.service.ts: unidades, grade, campanhas, agendamentos e
 * vagas fictícios, com os mesmos IDs dos outros serviços (dataset compartilhado).
 */
import { DEFAULT_TIMEZONE, type AppointmentStatus } from '@pulso/contracts';
import { seedUuid } from '@backend/libs/common/src/seed/dataset';
import { findSlotForStart } from '@backend/services/scheduling/src/domain/schedule';
import type { SeedContext } from '../../core/state';
import { nowIso } from '../../core/support';
import type { SchedulingSlot, SchedulingState } from './model';

/** Situações que ocupam o lugar da vaga (a falta não devolve a vaga, como no uso real). */
const OCCUPYING: AppointmentStatus[] = [
  'BOOKED',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'NO_SHOW',
];
/** Capacidade usada quando um agendamento fictício cai fora da grade (ex.: agenda de hoje num domingo). */
const FALLBACK_CAPACITY = 3;

const iso = (value: string) => new Date(value).toISOString();

export function seedScheduling({ dataset }: SeedContext): SchedulingState {
  const now = nowIso();

  // Vagas agregadas por (unidade, início): toda reserva aponta para uma vaga.
  const slots = new Map<string, SchedulingSlot>();
  for (const appointment of dataset.appointments) {
    const key = `${appointment.unitId}|${appointment.startsAt}`;
    let slot = slots.get(key);
    if (!slot) {
      const rules = dataset.scheduleRules
        .filter((rule) => rule.unitId === appointment.unitId)
        .map((rule) => ({ ...rule, active: true }));
      const startsAt = new Date(appointment.startsAt);
      const generated = findSlotForStart(rules, startsAt, DEFAULT_TIMEZONE);
      slot = {
        id: seedUuid(`slot:${key}`),
        unitId: appointment.unitId,
        startsAt: startsAt.toISOString(),
        endsAt: iso(appointment.endsAt),
        capacity: generated?.capacity ?? FALLBACK_CAPACITY,
        bookedCount: 0,
      };
      slots.set(key, slot);
    }
    if (OCCUPYING.includes(appointment.status)) slot.bookedCount += 1;
  }
  for (const slot of slots.values()) slot.capacity = Math.max(slot.capacity, slot.bookedCount, 1);

  return {
    units: dataset.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      address: unit.address,
      district: unit.district,
      city: unit.city,
      state: unit.state,
      zipCode: unit.zipCode,
      phone: unit.phone,
      openingHours: unit.openingHours,
      status: 'ACTIVE',
      timezone: DEFAULT_TIMEZONE,
      createdAt: now,
      updatedAt: now,
    })),
    rules: dataset.scheduleRules.map((rule) => ({ ...rule, active: true })),
    slots: [...slots.values()],
    blocks: [],
    campaigns: dataset.campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      bloodTypes: [...campaign.bloodTypes],
      unitId: campaign.unitId,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      active: true,
      createdAt: now,
      updatedAt: now,
    })),
    appointments: dataset.appointments.map((appointment) => ({
      id: appointment.id,
      code: appointment.code,
      donorId: appointment.donorId,
      unitId: appointment.unitId,
      slotId: slots.get(`${appointment.unitId}|${appointment.startsAt}`)!.id,
      startsAt: iso(appointment.startsAt),
      endsAt: iso(appointment.endsAt),
      status: appointment.status,
      campaignId: appointment.campaignId,
      rescheduledFromId: null,
      cancelledAt: appointment.cancelledAt ? iso(appointment.cancelledAt) : null,
      cancelledBy: appointment.cancelledBy,
      cancelReason: appointment.cancelledBy ? 'Cancelamento fictício de demonstração' : null,
      checkedInAt: appointment.checkedInAt ? iso(appointment.checkedInAt) : null,
      checkedInById: null,
      completedAt: appointment.completedAt ? iso(appointment.completedAt) : null,
      noShowAt: appointment.status === 'NO_SHOW' ? iso(appointment.endsAt) : null,
      reminderSentAt: null,
      createdAt: iso(appointment.createdAt),
      updatedAt: now,
    })),
  };
}

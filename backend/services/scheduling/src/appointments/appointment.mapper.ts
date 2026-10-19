import {
  APPOINTMENT_STATUSES,
  type AgendaItem,
  type AppointmentStatus,
  type AppointmentView,
  type DonorSummary,
  type UnitView,
} from '@pulso/contracts';
import type { HealthUnit, Prisma } from '../../generated/prisma';
import { canChange } from '../domain/schedule';

export const APPOINTMENT_INCLUDE = {
  unit: true,
  campaign: { select: { id: true, title: true } },
} as const;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_INCLUDE;
}>;

export function toUnitView(unit: HealthUnit): UnitView {
  return {
    id: unit.id,
    name: unit.name,
    address: unit.address,
    district: unit.district,
    city: unit.city,
    state: unit.state,
    zipCode: unit.zipCode,
    phone: unit.phone,
    openingHours: unit.openingHours,
    status: unit.status,
    timezone: unit.timezone,
  };
}

export function toAppointmentView(
  appointment: AppointmentWithRelations,
  now: Date = new Date(),
): AppointmentView {
  const { unit } = appointment;
  return {
    id: appointment.id,
    code: appointment.code,
    status: appointment.status,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    unit: {
      id: unit.id,
      name: unit.name,
      address: unit.address,
      district: unit.district,
      city: unit.city,
      phone: unit.phone,
    },
    campaign: appointment.campaign,
    createdAt: appointment.createdAt.toISOString(),
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    cancelledBy: appointment.cancelledBy,
    cancelReason: appointment.cancelReason,
    checkedInAt: appointment.checkedInAt?.toISOString() ?? null,
    completedAt: appointment.completedAt?.toISOString() ?? null,
    rescheduledFromId: appointment.rescheduledFromId,
    canChange: canChange(appointment.status, appointment.startsAt, now),
  };
}

/** Item da agenda da equipe: o nome vem do identity (o scheduling só guarda o UUID). */
export function toAgendaItem(
  appointment: AppointmentWithRelations,
  donor: DonorSummary | undefined,
): AgendaItem {
  return {
    appointmentId: appointment.id,
    code: appointment.code,
    status: appointment.status,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    checkedInAt: appointment.checkedInAt?.toISOString() ?? null,
    campaign: appointment.campaign,
    donor: {
      id: appointment.donorId,
      name: donor?.name ?? 'Doador não encontrado',
      donorCode: donor?.donorCode ?? null,
    },
  };
}

export function emptyStatusCounts(): Record<AppointmentStatus, number> {
  return Object.fromEntries(APPOINTMENT_STATUSES.map((status) => [status, 0])) as Record<
    AppointmentStatus,
    number
  >;
}

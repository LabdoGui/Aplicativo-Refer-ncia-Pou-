/**
 * Estado e mapeadores do módulo scheduling (espelho do schema "scheduling" e de
 * appointments/appointment.mapper.ts, campaigns.service.ts e units.service.ts).
 * Tudo em JSON: datas e horários como string ISO; datas de campanha AAAA-MM-DD.
 */
import {
  APPOINTMENT_STATUSES,
  type AgendaItem,
  type AppointmentStatus,
  type AppointmentView,
  type BloodType,
  type CampaignView,
  type CancelledBy,
  type DonorSummary,
  type ScheduleBlockView,
  type ScheduleRuleView,
  type UnitStatus,
  type UnitView,
} from '@pulso/contracts';
import { canChange } from '@backend/services/scheduling/src/domain/schedule';
import { fail } from '../../core/http';
import { internal } from '../../core/internal';
import { db } from '../../core/state';

export const SERVICE = 'scheduling';

/**
 * DEMO_EARLY_CHECK_IN do scheduling-service: ligado na demonstração, como no
 * docker-compose, para percorrer a jornada inteira (agendar → atender → doar).
 */
export const DEMO_EARLY_CHECK_IN = true;

export interface SchedulingUnit {
  id: string;
  name: string;
  address: string;
  district: string;
  city: string;
  state: string;
  zipCode: string | null;
  phone: string | null;
  openingHours: string | null;
  status: UnitStatus;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

/** Grade semanal em hora local da unidade (weekday: 1 = segunda … 7 = domingo). */
export interface SchedulingRule {
  id: string;
  unitId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacity: number;
  active: boolean;
}

/** Vaga materializada na primeira reserva (a disponibilidade vem da grade). */
export interface SchedulingSlot {
  id: string;
  unitId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
}

export interface SchedulingBlock {
  id: string;
  unitId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  createdById: string;
  createdAt: string;
}

export interface SchedulingCampaign {
  id: string;
  title: string;
  description: string;
  bloodTypes: BloodType[];
  /** null = todas as unidades */
  unitId: string | null;
  /** AAAA-MM-DD */
  startsAt: string;
  /** AAAA-MM-DD */
  endsAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingAppointment {
  id: string;
  code: string;
  donorId: string;
  unitId: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  campaignId: string | null;
  rescheduledFromId: string | null;
  cancelledAt: string | null;
  cancelledBy: CancelledBy | null;
  cancelReason: string | null;
  checkedInAt: string | null;
  checkedInById: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingState {
  units: SchedulingUnit[];
  rules: SchedulingRule[];
  slots: SchedulingSlot[];
  blocks: SchedulingBlock[];
  campaigns: SchedulingCampaign[];
  appointments: SchedulingAppointment[];
}

export const state = () => db().scheduling;

/** Situações em aberto (podem ser canceladas, reagendadas ou receber check-in). */
export const OPEN_STATUSES: AppointmentStatus[] = ['BOOKED', 'CONFIRMED'];
export const isOpen = (status: AppointmentStatus) => OPEN_STATUSES.includes(status);

/**
 * Executa uma alteração "em transação": se algo falhar no meio, o estado do
 * módulo e a trilha de auditoria voltam ao que eram (como o rollback do banco).
 * Eventos devem ser publicados só depois dos pontos que podem falhar.
 */
export function transaction<T>(fn: () => T): T {
  const root = db();
  const backup = structuredClone(root.scheduling);
  const auditLength = root.audit.length;
  try {
    return fn();
  } catch (error) {
    root.scheduling = backup;
    root.audit.length = auditLength;
    throw error;
  }
}

// --- Consultas ---------------------------------------------------------------

export function findUnit(id: string): SchedulingUnit | undefined {
  return state().units.find((unit) => unit.id === id);
}

export function findCampaign(id: string | null): SchedulingCampaign | undefined {
  return id ? state().campaigns.find((campaign) => campaign.id === id) : undefined;
}

export function findAppointment(id: string): SchedulingAppointment | undefined {
  return state().appointments.find((appointment) => appointment.id === id);
}

/** Unidade do agendamento (a FK garante que existe). */
export function unitOf(appointment: SchedulingAppointment): SchedulingUnit {
  const unit = findUnit(appointment.unitId);
  if (!unit) throw new Error(`[demo] unidade ${appointment.unitId} inexistente`);
  return unit;
}

export function APPOINTMENT_NOT_FOUND(): never {
  return fail(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
}

export function UNIT_NOT_FOUND(): never {
  return fail(404, 'UNIT_NOT_FOUND', 'Unidade não encontrada.');
}

/** Ordenação de texto como a do PostgreSQL (collation do banco, não binária). */
export const byText = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

// --- Mapeadores (appointment.mapper.ts) ----------------------------------------

export function toUnitView(unit: SchedulingUnit): UnitView {
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

function campaignRef(id: string | null): { id: string; title: string } | null {
  const campaign = findCampaign(id);
  return campaign ? { id: campaign.id, title: campaign.title } : null;
}

export function toAppointmentView(
  appointment: SchedulingAppointment,
  now: Date = new Date(),
): AppointmentView {
  const unit = unitOf(appointment);
  return {
    id: appointment.id,
    code: appointment.code,
    status: appointment.status,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    unit: {
      id: unit.id,
      name: unit.name,
      address: unit.address,
      district: unit.district,
      city: unit.city,
      phone: unit.phone,
    },
    campaign: campaignRef(appointment.campaignId),
    createdAt: appointment.createdAt,
    cancelledAt: appointment.cancelledAt,
    cancelledBy: appointment.cancelledBy,
    cancelReason: appointment.cancelReason,
    checkedInAt: appointment.checkedInAt,
    completedAt: appointment.completedAt,
    rescheduledFromId: appointment.rescheduledFromId,
    canChange: canChange(appointment.status, new Date(appointment.startsAt), now),
  };
}

/** Item da agenda da equipe: o nome vem do identity (o scheduling só guarda o UUID). */
export function toAgendaItem(
  appointment: SchedulingAppointment,
  donor: DonorSummary | undefined,
): AgendaItem {
  return {
    appointmentId: appointment.id,
    code: appointment.code,
    status: appointment.status,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    checkedInAt: appointment.checkedInAt,
    campaign: campaignRef(appointment.campaignId),
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

export function toCampaignView(campaign: SchedulingCampaign): CampaignView {
  const unit = campaign.unitId ? findUnit(campaign.unitId) : undefined;
  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    bloodTypes: [...campaign.bloodTypes],
    unit: unit ? { id: unit.id, name: unit.name } : null,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    active: campaign.active,
  };
}

export function toRuleView(rule: SchedulingRule): ScheduleRuleView {
  return {
    id: rule.id,
    weekday: rule.weekday,
    startTime: rule.startTime,
    endTime: rule.endTime,
    slotMinutes: rule.slotMinutes,
    capacity: rule.capacity,
    active: rule.active,
  };
}

export function toBlockView(block: SchedulingBlock): ScheduleBlockView {
  return {
    id: block.id,
    startsAt: block.startsAt,
    endsAt: block.endsAt,
    reason: block.reason,
    createdAt: block.createdAt,
  };
}

// --- Resumos de doadores (identity/donor-directory.ts) -------------------------

/** Nomes e resumos dos doadores, sempre lidos do identity (fonte única dos dados pessoais). */
export function donorSummaries(ids: string[]): Map<string, DonorSummary> {
  const unique = [...new Set(ids)];
  const result = new Map<string, DonorSummary>();
  if (unique.length === 0) return result;
  for (const summary of internal.identity.donorSummaries(unique)) result.set(summary.id, summary);
  return result;
}

export function donorSummary(id: string): DonorSummary {
  return (
    donorSummaries([id]).get(id) ?? {
      id,
      name: 'Doador não encontrado',
      donorCode: '—',
      age: null,
      declaredBloodType: null,
    }
  );
}

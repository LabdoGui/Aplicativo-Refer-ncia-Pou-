import type { AppointmentStatus, BloodType, CancelledBy, UnitStatus } from '../domain';
import type { DonorSummary } from './auth';

export interface UnitView {
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
}

export interface UnitInput {
  name: string;
  address: string;
  district: string;
  city: string;
  state: string;
  zipCode?: string | null;
  phone?: string | null;
  openingHours?: string | null;
  status?: UnitStatus;
}

/** Regra da grade semanal, em hora local da unidade. weekday: 1 = segunda … 7 = domingo. */
export interface ScheduleRuleView {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacity: number;
  active: boolean;
}

export type ScheduleRuleInput = Omit<ScheduleRuleView, 'id'>;

export interface ReplaceScheduleRulesRequest {
  rules: ScheduleRuleInput[];
}

export interface ScheduleBlockView {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  createdAt: string;
}

export interface CreateScheduleBlockRequest {
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  capacity: number;
  remaining: number;
}

export interface AvailabilityDay {
  /** AAAA-MM-DD, no fuso da unidade */
  date: string;
  slots: AvailabilitySlot[];
}

export interface AvailabilityResponse {
  unitId: string;
  timezone: string;
  days: AvailabilityDay[];
}

export interface AppointmentUnitView {
  id: string;
  name: string;
  address: string;
  district: string;
  city: string;
  phone: string | null;
}

export interface AppointmentView {
  id: string;
  code: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  unit: AppointmentUnitView;
  campaign: { id: string; title: string } | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: CancelledBy | null;
  cancelReason: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  rescheduledFromId: string | null;
  /** O doador ainda pode cancelar/reagendar (RN06). */
  canChange: boolean;
}

export interface CreateAppointmentRequest {
  unitId: string;
  startsAt: string;
  campaignId?: string | null;
}

export interface RescheduleAppointmentRequest {
  unitId: string;
  startsAt: string;
}

export interface CancelAppointmentRequest {
  reason?: string;
}

export interface AgendaItem {
  appointmentId: string;
  code: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  checkedInAt: string | null;
  campaign: { id: string; title: string } | null;
  donor: { id: string; name: string; donorCode: string | null };
}

export interface AgendaResponse {
  unit: { id: string; name: string };
  date: string;
  items: AgendaItem[];
  counts: Record<AppointmentStatus, number>;
}

/** Agendamento visto pela equipe (detalhe do atendimento), com o resumo do doador. */
export interface StaffAppointmentView extends AgendaItem {
  unit: { id: string; name: string };
  donorSummary: DonorSummary;
}

/** Agendamento para outros serviços (GET /internal/appointments/:id). */
export interface InternalAppointmentView {
  id: string;
  code: string;
  donorId: string;
  unitId: string;
  unitName: string;
  status: AppointmentStatus;
  startsAt: string;
  campaignId: string | null;
  campaignTitle: string | null;
}

export interface AdminAppointmentsQuery {
  unitId?: string;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminAppointmentItem extends AgendaItem {
  unit: { id: string; name: string };
  cancelledBy: CancelledBy | null;
}

export interface CampaignView {
  id: string;
  title: string;
  description: string;
  bloodTypes: BloodType[];
  unit: { id: string; name: string } | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export interface CampaignInput {
  title: string;
  description: string;
  bloodTypes: BloodType[];
  unitId?: string | null;
  /** AAAA-MM-DD */
  startsAt: string;
  /** AAAA-MM-DD */
  endsAt: string;
  active?: boolean;
}

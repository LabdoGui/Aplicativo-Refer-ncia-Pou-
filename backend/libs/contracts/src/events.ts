import type { Role } from './roles';
import type { StockStatus } from './domain';

/**
 * Eventos de domínio publicados no exchange `pulso.events` (RabbitMQ, tipo topic).
 * A routing key é o próprio `type`.
 *
 * Regra de privacidade: eventos carregam IDs e fatos mínimos. NUNCA trafegam
 * respostas da pré-triagem, campos da triagem ou motivos de inaptidão.
 */
export const EVENT_EXCHANGE = 'pulso.events';

export const EVENTS = {
  USER_REGISTERED: 'identity.user.registered',
  APPOINTMENT_BOOKED: 'scheduling.appointment.booked',
  APPOINTMENT_CANCELLED: 'scheduling.appointment.cancelled',
  APPOINTMENT_RESCHEDULED: 'scheduling.appointment.rescheduled',
  APPOINTMENT_REMINDER_DUE: 'scheduling.appointment.reminder_due',
  APPOINTMENT_CHECKED_IN: 'scheduling.appointment.checked_in',
  ATTENDANCE_COMPLETED: 'clinical.attendance.completed',
  DONATION_COMPLETED: 'clinical.donation.completed',
  DOCUMENT_ISSUED: 'clinical.document.issued',
  STOCK_LEVEL_CHANGED: 'inventory.stock.level_changed',
  ACHIEVEMENT_UNLOCKED: 'engagement.achievement.unlocked',
  POINTS_AWARDED: 'engagement.points.awarded',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

export interface UserRegisteredData {
  userId: string;
  name: string;
  role: Role;
}

export interface AppointmentBookedData {
  appointmentId: string;
  code: string;
  donorId: string;
  unitId: string;
  unitName: string;
  startsAt: string;
  campaignId: string | null;
}

export interface AppointmentCancelledData {
  appointmentId: string;
  donorId: string;
  startsAt: string;
  cancelledBy: 'DONOR' | 'STAFF' | 'SYSTEM';
}

export interface AppointmentRescheduledData {
  appointmentId: string;
  previousAppointmentId: string;
  donorId: string;
  unitName: string;
  startsAt: string;
}

export interface AppointmentReminderDueData {
  appointmentId: string;
  donorId: string;
  unitName: string;
  startsAt: string;
}

export interface AppointmentCheckedInData {
  appointmentId: string;
  donorId: string;
  unitId: string;
}

export interface AttendanceCompletedData {
  appointmentId: string | null;
  donorId: string;
  unitId: string;
  screeningId: string;
  donationCompleted: boolean;
  donationId: string | null;
  campaignId: string | null;
  occurredAt: string;
}

export interface DonationCompletedData {
  donationId: string;
  code: string;
  donorId: string;
  unitId: string;
  campaignId: string | null;
  occurredAt: string;
}

export interface DocumentIssuedData {
  documentId: string;
  donorId: string;
}

export interface StockLevelChangedData {
  bloodType: string;
  previousStatus: StockStatus;
  status: StockStatus;
  quantity: number;
}

export interface AchievementUnlockedData {
  donorId: string;
  achievementCode: string;
  achievementName: string;
}

export interface PointsAwardedData {
  donorId: string;
  points: number;
  reason: string;
  totalPoints: number;
}

export interface EventPayloads {
  'identity.user.registered': UserRegisteredData;
  'scheduling.appointment.booked': AppointmentBookedData;
  'scheduling.appointment.cancelled': AppointmentCancelledData;
  'scheduling.appointment.rescheduled': AppointmentRescheduledData;
  'scheduling.appointment.reminder_due': AppointmentReminderDueData;
  'scheduling.appointment.checked_in': AppointmentCheckedInData;
  'clinical.attendance.completed': AttendanceCompletedData;
  'clinical.donation.completed': DonationCompletedData;
  'clinical.document.issued': DocumentIssuedData;
  'inventory.stock.level_changed': StockLevelChangedData;
  'engagement.achievement.unlocked': AchievementUnlockedData;
  'engagement.points.awarded': PointsAwardedData;
}

/** Envelope inspirado no CloudEvents. */
export interface EventEnvelope<T extends EventType = EventType> {
  id: string;
  type: T;
  source: string;
  occurredAt: string;
  correlationId?: string;
  data: EventPayloads[T];
}

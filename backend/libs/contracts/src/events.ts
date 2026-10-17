import type { Role } from './roles';
import type { BloodType, CancelledBy, StockStatus } from './domain';

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
  ATTENDANCE_COMPLETED: 'clinical.attendance.completed',
  DONATION_COMPLETED: 'clinical.donation.completed',
  DOCUMENT_ISSUED: 'clinical.document.issued',
  STOCK_LEVEL_CHANGED: 'inventory.stock.level_changed',
  ACHIEVEMENT_UNLOCKED: 'engagement.achievement.unlocked',
  POINTS_AWARDED: 'engagement.points.awarded',
  HOURS_REVIEWED: 'engagement.hours.reviewed',
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
  unitName: string;
  startsAt: string;
  cancelledBy: CancelledBy;
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

/**
 * Atendimento finalizado (com ou sem doação). `attendanceId` é o id da triagem
 * profissional, que representa o atendimento.
 */
export interface AttendanceCompletedData {
  attendanceId: string;
  appointmentId: string | null;
  donorId: string;
  unitId: string;
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
  attendanceId: string;
  campaignId: string | null;
  occurredAt: string;
}

export interface DocumentIssuedData {
  documentId: string;
  donorId: string;
  title: string;
}

export interface StockLevelChangedData {
  bloodType: BloodType;
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

export interface HoursReviewedData {
  hoursId: string;
  donorId: string;
  hours: number;
  status: 'APPROVED' | 'REJECTED';
  institutionName: string;
}

export interface EventPayloads {
  'identity.user.registered': UserRegisteredData;
  'scheduling.appointment.booked': AppointmentBookedData;
  'scheduling.appointment.cancelled': AppointmentCancelledData;
  'scheduling.appointment.rescheduled': AppointmentRescheduledData;
  'scheduling.appointment.reminder_due': AppointmentReminderDueData;
  'clinical.attendance.completed': AttendanceCompletedData;
  'clinical.donation.completed': DonationCompletedData;
  'clinical.document.issued': DocumentIssuedData;
  'inventory.stock.level_changed': StockLevelChangedData;
  'engagement.achievement.unlocked': AchievementUnlockedData;
  'engagement.points.awarded': PointsAwardedData;
  'engagement.hours.reviewed': HoursReviewedData;
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

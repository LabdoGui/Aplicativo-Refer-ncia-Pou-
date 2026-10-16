/**
 * Vocabulário de domínio compartilhado entre serviços e frontend.
 * Os valores são estáveis (persistidos e trafegados); os rótulos são para exibição.
 */

export const BLOOD_TYPES = [
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const BLOOD_TYPE_LABELS: Record<BloodType, string> = {
  A_POS: 'A+',
  A_NEG: 'A−',
  B_POS: 'B+',
  B_NEG: 'B−',
  AB_POS: 'AB+',
  AB_NEG: 'AB−',
  O_POS: 'O+',
  O_NEG: 'O−',
};

export const APPOINTMENT_STATUSES = [
  'BOOKED',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Estados que contam como "agendamento ativo" (no máximo 1 por doador). */
export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'BOOKED',
  'CONFIRMED',
  'CHECKED_IN',
];

/** Resultado da pré-triagem: sempre informativo, nunca "inapto". */
export const PRE_SCREENING_RESULTS = ['FAVORABLE', 'NEEDS_EVALUATION'] as const;
export type PreScreeningResult = (typeof PRE_SCREENING_RESULTS)[number];

/** Resultado da triagem presencial, definido pelo profissional de saúde. */
export const SCREENING_RESULTS = ['FIT', 'UNFIT', 'NEEDS_EVALUATION'] as const;
export type ScreeningResult = (typeof SCREENING_RESULTS)[number];

export const DONATION_STATUSES = ['COMPLETED', 'NOT_COMPLETED'] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const STOCK_STATUSES = ['NORMAL', 'ATTENTION', 'CRITICAL'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const MOVEMENT_TYPES = ['IN', 'OUT'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const HOURS_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type HoursStatus = (typeof HOURS_STATUSES)[number];

export const UNIT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const USER_STATUSES = ['ACTIVE', 'DISABLED', 'ANONYMIZED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CONSENT_PURPOSES = [
  'TERMS_PRIVACY',
  'SHARE_PRESCREENING',
  'RANKING_PUBLIC',
  'COMMUNICATIONS',
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const NOTIFICATION_TYPES = [
  'WELCOME',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_REMINDER',
  'DONATION_COMPLETED',
  'ACHIEVEMENT_UNLOCKED',
  'POINTS_AWARDED',
  'DOCUMENT_ISSUED',
  'STOCK_ALERT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL_SIMULATED'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Fuso horário de referência das unidades de coleta. */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

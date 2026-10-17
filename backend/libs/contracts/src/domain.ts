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

/**
 * Resultado da pré-triagem (RN07): sempre informativo. Nunca autoriza nem impede
 * a doação; quem decide é a equipe de saúde no atendimento presencial.
 */
export const PRE_SCREENING_RESULTS = ['FAVORABLE', 'TALK_TO_UNIT', 'WAIT_UNTIL'] as const;
export type PreScreeningResult = (typeof PRE_SCREENING_RESULTS)[number];

export const PRE_SCREENING_RESULT_LABELS: Record<PreScreeningResult, string> = {
  FAVORABLE: 'Pode seguir para o agendamento',
  TALK_TO_UNIT: 'Converse com a unidade',
  WAIT_UNTIL: 'Aguarde a data informativa',
};

/** Severidade de cada regra da pré-triagem (RN07). A mais alta define o resultado. */
export const RULE_SEVERITIES = ['INFO', 'TALK_TO_UNIT', 'WAIT_UNTIL'] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

export const QUESTION_TYPES = ['BOOLEAN', 'SINGLE_CHOICE', 'NUMBER', 'DATE'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * Operadores das regras. WITHIN_DAYS compara uma data respondida com hoje
 * ("nos últimos N dias"); N vem do valor da regra ou de uma configuração.
 */
export const RULE_OPERATORS = [
  'EQUALS',
  'NOT_EQUALS',
  'LT',
  'LTE',
  'GT',
  'GTE',
  'WITHIN_DAYS',
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

/** Toda regra ou parâmetro com efeito clínico nasce pendente de validação (RN08). */
export const VALIDATION_STATUSES = ['PENDING_VALIDATION', 'VALIDATED'] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  PENDING_VALIDATION: 'Pendente de validação por profissional de saúde',
  VALIDATED: 'Validada',
};

/** Resultado da triagem presencial, definido pelo profissional de saúde. */
export const SCREENING_RESULTS = ['FIT', 'UNFIT', 'NEEDS_EVALUATION'] as const;
export type ScreeningResult = (typeof SCREENING_RESULTS)[number];

export const SCREENING_RESULT_LABELS: Record<ScreeningResult, string> = {
  FIT: 'Apto',
  UNFIT: 'Inapto',
  NEEDS_EVALUATION: 'Necessita avaliação',
};

/** Tipos dos campos configuráveis da triagem profissional. */
export const SCREENING_FIELD_TYPES = ['NUMBER', 'TEXT', 'BOOLEAN', 'SELECT'] as const;
export type ScreeningFieldType = (typeof SCREENING_FIELD_TYPES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: 'Agendado',
  CONFIRMED: 'Confirmado',
  CHECKED_IN: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

export const CANCELLED_BY = ['DONOR', 'STAFF', 'SYSTEM'] as const;
export type CancelledBy = (typeof CANCELLED_BY)[number];

export const DONATION_STATUSES = ['COMPLETED', 'NOT_COMPLETED'] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  COMPLETED: 'Doação concluída',
  NOT_COMPLETED: 'Doação não concluída',
};

/** RN11: CRÍTICO abaixo do mínimo; ATENÇÃO entre o mínimo e o ideal; ADEQUADO a partir do ideal. */
export const STOCK_STATUSES = ['NORMAL', 'ATTENTION', 'CRITICAL'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  NORMAL: 'Adequado',
  ATTENTION: 'Atenção',
  CRITICAL: 'Crítico',
};

export function stockStatusFor(quantity: number, minimum: number, ideal: number): StockStatus {
  if (quantity < minimum) return 'CRITICAL';
  if (quantity < ideal) return 'ATTENTION';
  return 'NORMAL';
}

export const MOVEMENT_TYPES = ['IN', 'OUT'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
};

/**
 * Motivos de movimentação do estoque. RN10: a doação concluída não gera entrada
 * automática, porque a bolsa ainda passa por processamento e liberação.
 */
export const MOVEMENT_REASONS = {
  PROCESSED_COLLECTION: { type: 'IN', label: 'Coleta processada e liberada' },
  TRANSFER_IN: { type: 'IN', label: 'Transferência recebida' },
  ADJUSTMENT_IN: { type: 'IN', label: 'Ajuste de inventário (entrada)' },
  HOSPITAL_DISTRIBUTION: { type: 'OUT', label: 'Distribuição para hospital' },
  TRANSFER_OUT: { type: 'OUT', label: 'Transferência enviada' },
  EXPIRED_DISCARD: { type: 'OUT', label: 'Descarte por validade' },
  ADJUSTMENT_OUT: { type: 'OUT', label: 'Ajuste de inventário (saída)' },
} as const satisfies Record<string, { type: MovementType; label: string }>;
export type MovementReason = keyof typeof MOVEMENT_REASONS;
export const MOVEMENT_REASON_CODES = Object.keys(MOVEMENT_REASONS) as MovementReason[];

export const HOURS_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type HoursStatus = (typeof HOURS_STATUSES)[number];

export const HOURS_STATUS_LABELS: Record<HoursStatus, string> = {
  PENDING: 'Aguardando a instituição',
  APPROVED: 'Aprovadas',
  REJECTED: 'Não aprovadas',
};

export const DOCUMENT_TYPES = ['DONATION_DECLARATION', 'ATTENDANCE_DECLARATION'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  DONATION_DECLARATION: 'Declaração de doação',
  ATTENDANCE_DECLARATION: 'Declaração de comparecimento',
};

/** Aviso obrigatório em todo documento emitido (RN16). */
export const DOCUMENT_DISCLAIMER =
  'Documento acadêmico de demonstração, sem validade legal. Dados fictícios.';

export const UNIT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const USER_STATUSES = ['ACTIVE', 'DISABLED', 'ANONYMIZED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Finalidades de consentimento geridas pelo identity. O compartilhamento da
 * pré-triagem é decidido a cada envio (clinical) e o ranking é opt-in no
 * engagement, cada um junto da tela onde a escolha faz sentido.
 */
export const CONSENT_PURPOSES = ['TERMS_PRIVACY', 'COMMUNICATIONS'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** Versão vigente dos Termos de Uso e da Política de Privacidade. */
export const TERMS_VERSION = '2026-10';

export const NOTIFICATION_TYPES = [
  'WELCOME',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_REMINDER',
  'ATTENDANCE_COMPLETED',
  'DONATION_COMPLETED',
  'ACHIEVEMENT_UNLOCKED',
  'POINTS_AWARDED',
  'DOCUMENT_ISSUED',
  'HOURS_REVIEWED',
  'STOCK_ALERT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Fuso horário de referência das unidades de coleta. */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Política de agendamento do protótipo (RN05 e RN06). Os valores são
 * [HIPÓTESE] de trabalho, a confirmar com a instituição parceira.
 */
export const SCHEDULING_POLICY = {
  /** Antecedência mínima para agendar (minutos). */
  minLeadMinutes: 120,
  /** Até quantos dias à frente o doador pode agendar. */
  maxDaysAhead: 60,
  /** O doador pode cancelar ou reagendar até X horas antes do horário. */
  cancelMinHours: 2,
} as const;

/** Níveis da gamificação, por pontos acumulados (sem prêmios materiais, RN13). */
export const LEVELS = [
  { code: 'FIRST_STEP', name: 'Primeiro Passo', minPoints: 0 },
  { code: 'DONOR', name: 'Doador', minPoints: 100 },
  { code: 'FREQUENT_DONOR', name: 'Doador Frequente', minPoints: 400 },
  { code: 'COMMUNITY_HERO', name: 'Herói da Comunidade', minPoints: 700 },
] as const;
export type LevelCode = (typeof LEVELS)[number]['code'];
export type Level = (typeof LEVELS)[number];

export function levelFor(points: number): Level {
  let current: Level = LEVELS[0];
  for (const level of LEVELS) if (points >= level.minPoints) current = level;
  return current;
}

export function nextLevelFor(points: number): Level | null {
  return LEVELS.find((level) => level.minPoints > points) ?? null;
}

/**
 * Base dos pontos (D4): por comparecimento (atendimento finalizado, qualquer
 * que seja o resultado da triagem, RN12) ou só por doação concluída.
 */
export const POINTS_BASES = ['ATTENDANCE', 'DONATION'] as const;
export type PointsBasis = (typeof POINTS_BASES)[number];

export const POINT_REASONS = ['FIRST', 'RECURRING', 'CAMPAIGN'] as const;
export type PointReason = (typeof POINT_REASONS)[number];

export const POINT_REASON_LABELS: Record<PointsBasis, Record<PointReason, string>> = {
  ATTENDANCE: {
    FIRST: 'Primeiro comparecimento para doar',
    RECURRING: 'Novo comparecimento para doar',
    CAMPAIGN: 'Participação em campanha',
  },
  DONATION: {
    FIRST: 'Primeira doação',
    RECURRING: 'Doação recorrente',
    CAMPAIGN: 'Participação em campanha',
  },
};

export const ACHIEVEMENT_CODES = [
  'FIRST_DONATION',
  'RECURRING_DONOR',
  'THREE_DONATIONS',
  'FIVE_DONATIONS',
  'CAMPAIGN_SPECIAL',
] as const;
export type AchievementCode = (typeof ACHIEVEMENT_CODES)[number];

export const ACHIEVEMENT_CRITERIA = ['DONATION_COUNT', 'CAMPAIGN_DONATION'] as const;
export type AchievementCriteria = (typeof ACHIEVEMENT_CRITERIA)[number];

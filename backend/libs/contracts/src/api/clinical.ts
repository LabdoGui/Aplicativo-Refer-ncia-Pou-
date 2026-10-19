import type {
  BloodType,
  DocumentType,
  DonationStatus,
  PreScreeningResult,
  QuestionType,
  RuleOperator,
  RuleSeverity,
  ScreeningFieldType,
  ScreeningResult,
  ValidationStatus,
} from '../domain';

/** Aviso exibido em toda a pré-triagem (texto exigido pelo enunciado). */
export const PRE_SCREENING_DISCLAIMER =
  'Esta avaliação é apenas informativa. A aptidão para doação será determinada pela equipe de saúde no atendimento presencial.';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface PreScreeningQuestion {
  id: string;
  code: string;
  step: number;
  order: number;
  text: string;
  helpText: string | null;
  type: QuestionType;
  options: QuestionOption[] | null;
  required: boolean;
  /** Pergunta condicional: só aparece se outra resposta for igual ao valor. */
  showIf: { questionCode: string; equals: string | boolean } | null;
}

export interface PreScreeningStep {
  step: number;
  title: string;
  description: string;
}

export interface PreScreeningQuestionnaire {
  ruleSetId: string;
  ruleSetVersion: string;
  validationStatus: ValidationStatus;
  normativeReference: string | null;
  disclaimer: string;
  steps: PreScreeningStep[];
  questions: PreScreeningQuestion[];
}

export type AnswerValue = string | number | boolean;

export interface PreScreeningSubmitRequest {
  answers: Record<string, AnswerValue>;
  /** Consentimento específico para a equipe da unidade ver as respostas. */
  shareWithStaff: boolean;
}

export interface PreScreeningGuidance {
  severity: RuleSeverity;
  message: string;
  waitUntil: string | null;
}

export interface PreScreeningResultView {
  id: string;
  result: PreScreeningResult;
  guidance: PreScreeningGuidance[];
  waitUntil: string | null;
  sharedWithStaff: boolean;
  ruleSetVersion: string;
  validationStatus: ValidationStatus;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

/**
 * Pré-triagem compartilhada, vista pelo enfermeiro (acesso auditado). Só a mais
 * recente do doador, ainda válida e enquanto o atendimento está em aberto.
 */
export interface SharedPreScreeningView {
  id: string;
  result: PreScreeningResult;
  createdAt: string;
  expiresAt: string;
  guidance: PreScreeningGuidance[];
  answers: Array<{ step: number; question: string; answer: string }>;
}

export interface ScreeningFieldView {
  id: string;
  code: string;
  label: string;
  type: ScreeningFieldType;
  unit: string | null;
  options: QuestionOption[] | null;
  helpText: string | null;
  required: boolean;
  /** Limites só contra erro de digitação (não são critérios clínicos). */
  min: number | null;
  max: number | null;
  order: number;
  active: boolean;
}

export type ScreeningFieldInput = Omit<ScreeningFieldView, 'id'>;

export interface ProfessionalScreeningRequest {
  appointmentId: string;
  values: Record<string, AnswerValue>;
  result: ScreeningResult;
  notes?: string;
}

/** Atendimento registrado pela equipe (a triagem profissional representa o atendimento). */
export interface AttendanceStaffView {
  id: string;
  appointmentId: string | null;
  donorId: string;
  unitId: string;
  /**
   * Resultado e profissional: só enquanto o atendimento está em aberto ou foi
   * finalizado hoje (leitura auditada). Depois disso, null.
   */
  result: ScreeningResult | null;
  professionalName: string | null;
  createdAt: string;
  donation: { id: string; code: string; status: DonationStatus } | null;
  /** Atendimento finalizado (com doação registrada ou triagem sem aptidão). */
  completed: boolean;
}

export interface RecordDonationRequest {
  attendanceId: string;
  bloodType: BloodType;
  volumeMl: number;
  status: DonationStatus;
  notes?: string;
}

/** Atendimento visto pelo doador: sem resultado nem valores da triagem (RN19). */
export interface DonorAttendanceView {
  id: string;
  attendedAt: string;
  unitName: string;
  campaignTitle: string | null;
  donation: {
    id: string;
    code: string;
    status: DonationStatus;
    volumeMl: number | null;
  } | null;
  documents: Array<{ id: string; type: DocumentType }>;
}

export interface EligibilityView {
  lastDonationAt: string | null;
  /** Data informativa (RN04): só orienta; quem decide é a equipe. */
  nextEligibleAt: string | null;
  intervalDays: number;
  validationStatus: ValidationStatus;
}

export interface DocumentView {
  id: string;
  type: DocumentType;
  title: string;
  attendanceId: string;
  issuedAt: string;
  verificationCode: string;
}

export interface IssueDocumentRequest {
  attendanceId: string;
  type: DocumentType;
}

/** Verificação pública: só o necessário para confirmar a autenticidade. */
export interface DocumentVerification {
  valid: boolean;
  type: DocumentType | null;
  title: string | null;
  holderInitials: string | null;
  unitName: string | null;
  attendanceDate: string | null;
  issuedAt: string | null;
}

export interface ClinicalSettingsView {
  donationIntervalDays: number;
  preScreeningValidityDays: number;
  intervalValidationStatus: ValidationStatus;
}

export type UpdateClinicalSettingsRequest = Partial<
  Pick<ClinicalSettingsView, 'donationIntervalDays' | 'preScreeningValidityDays'>
>;

export interface ScreeningRuleView {
  id: string;
  questionCode: string;
  questionText: string;
  operator: RuleOperator;
  value: AnswerValue;
  /** Para WITHIN_DAYS: usa uma configuração (ex.: donationIntervalDays) em vez de número fixo. */
  settingKey: string | null;
  severity: RuleSeverity;
  message: string;
  validationStatus: ValidationStatus;
  active: boolean;
}

export interface UpdateScreeningRuleRequest {
  message?: string;
  active?: boolean;
}

export interface UpdateQuestionRequest {
  text?: string;
  helpText?: string | null;
  active?: boolean;
}

export interface ScreeningConfigView {
  ruleSet: {
    id: string;
    version: string;
    validationStatus: ValidationStatus;
    normativeReference: string | null;
    publishedAt: string | null;
  };
  questions: Array<PreScreeningQuestion & { active: boolean }>;
  rules: ScreeningRuleView[];
}

export interface AdminDonationItem {
  id: string;
  code: string;
  status: DonationStatus;
  bloodType: BloodType;
  volumeMl: number;
  unitId: string;
  unitName: string;
  occurredAt: string;
  campaignTitle: string | null;
}

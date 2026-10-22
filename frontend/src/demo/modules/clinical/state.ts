/**
 * Fatia "clinical" do estado da demonstração: o mesmo modelo do schema
 * clinical do back-end (prisma/schema.prisma), só com JSON (datas em ISO).
 * Simplificação: os campos cifrados no banco real (respostas, orientações,
 * valores da triagem, observações, código do documento) ficam em claro, porque
 * nunca saem do aparelho.
 */
import type {
  AnswerValue,
  BloodType,
  DocumentType,
  DonationStatus,
  PreScreeningGuidance,
  PreScreeningResult,
  QuestionOption,
  QuestionType,
  RuleOperator,
  RuleSeverity,
  ScreeningFieldType,
  ScreeningResult,
  SharedPreScreeningView,
  ValidationStatus,
} from '@pulso/contracts';
import { db } from '../../core/state';

export const SERVICE = 'clinical';

/** Versão do questionário + regras (RN08). */
export interface ClinicalRuleSet {
  id: string;
  version: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  validationStatus: ValidationStatus;
  normativeReference: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ClinicalQuestion {
  id: string;
  ruleSetId: string;
  code: string;
  step: number;
  order: number;
  text: string;
  helpText: string | null;
  type: QuestionType;
  options: QuestionOption[] | null;
  required: boolean;
  showIfCode: string | null;
  showIfValue: AnswerValue | null;
  active: boolean;
}

export interface ClinicalRule {
  id: string;
  ruleSetId: string;
  questionId: string;
  operator: RuleOperator;
  value: AnswerValue;
  /** WITHIN_DAYS: dias vindos de uma configuração (ex.: donationIntervalDays). */
  settingKey: string | null;
  severity: RuleSeverity;
  message: string;
  validationStatus: ValidationStatus;
  active: boolean;
  order: number;
}

export interface ClinicalPreScreening {
  id: string;
  donorId: string;
  ruleSetId: string;
  /** Versão das regras no momento da avaliação (RN08). */
  ruleSetVersion: string | null;
  result: PreScreeningResult;
  triggeredRuleIds: string[];
  /** Orientações exibidas ao doador (cifradas no back-end). */
  guidance: PreScreeningGuidance[];
  /** Respostas como a equipe as vê; só com o consentimento de compartilhamento (UC03). */
  answers: SharedPreScreeningView['answers'] | null;
  sharedWithStaff: boolean;
  /** AAAA-MM-DD */
  waitUntil: string | null;
  createdAt: string;
  expiresAt: string;
}

/** Campo configurável da triagem profissional (sem limiares clínicos automáticos). */
export interface ClinicalField {
  id: string;
  code: string;
  label: string;
  type: ScreeningFieldType;
  unit: string | null;
  options: QuestionOption[] | null;
  helpText: string | null;
  required: boolean;
  min: number | null;
  max: number | null;
  order: number;
  active: boolean;
}

/** Triagem profissional = atendimento. */
export interface ClinicalAttendance {
  id: string;
  appointmentId: string | null;
  donorId: string;
  unitId: string;
  unitName: string;
  campaignId: string | null;
  campaignTitle: string | null;
  professionalId: string;
  professionalName: string;
  result: ScreeningResult;
  values: Record<string, AnswerValue>;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ClinicalDonation {
  id: string;
  code: string;
  attendanceId: string;
  donorId: string;
  unitId: string;
  unitName: string;
  campaignId: string | null;
  professionalId: string;
  bloodType: BloodType;
  volumeMl: number;
  status: DonationStatus;
  notes: string | null;
  occurredAt: string;
  /** Data informativa da próxima doação (RN04), AAAA-MM-DD. */
  nextEligibleAt: string | null;
  createdAt: string;
}

export interface ClinicalDocument {
  id: string;
  donorId: string;
  attendanceId: string;
  type: DocumentType;
  title: string;
  /** SHA-256 da forma canônica do código (a busca pública usa o hash). */
  verificationCodeHash: string;
  /** Código para o titular consultar depois (cifrado no back-end). */
  verificationCode: string;
  holderInitials: string;
  unitName: string;
  /** AAAA-MM-DD */
  attendanceDate: string;
  /** PDF em base64 (vazio depois da exclusão da conta). */
  pdfBase64: string;
  sha256: string;
  issuedAt: string;
}

export interface ClinicalSettingRow {
  key: string;
  value: number;
  validationStatus: ValidationStatus | null;
  updatedById: string | null;
  updatedAt: string;
}

export interface ClinicalState {
  settings: ClinicalSettingRow[];
  ruleSets: ClinicalRuleSet[];
  questions: ClinicalQuestion[];
  rules: ClinicalRule[];
  preScreenings: ClinicalPreScreening[];
  fields: ClinicalField[];
  attendances: ClinicalAttendance[];
  donations: ClinicalDonation[];
  documents: ClinicalDocument[];
  /** Contas excluídas (identity.user.deleted): bloqueia escritas de tokens ainda válidos. */
  deletedUsers: string[];
}

export const clinical = () => db().clinical;

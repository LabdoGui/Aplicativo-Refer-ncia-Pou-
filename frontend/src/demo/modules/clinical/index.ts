/**
 * Módulo clinical da demonstração (espelho do clinical-service): pré-triagem
 * informativa, triagem profissional (atendimento), doações, documentos com
 * verificação pública, configuração do questionário e configurações clínicas.
 */
import { internal } from '../../core/internal';
import { registerAttendances } from './attendances';
import { registerDocuments } from './documents';
import { registerDonations } from './donations';
import { purgeExpiredAnswers, registerPreScreening } from './pre-screening';
import { registerPrivacy } from './privacy';
import { registerScreeningConfig } from './screening-config';
import { registerSettings } from './settings';
import { clinicalStats } from './stats';

export type { ClinicalState } from './state';
export { seedClinical } from './seed';

export function registerClinical(): void {
  registerPreScreening();
  registerAttendances();
  registerDonations();
  registerDocuments();
  registerScreeningConfig();
  registerSettings();
  registerPrivacy();
  internal.clinical.stats = clinicalStats;
  // Job diário do back-end (AnswersRetentionJob, 03h15): roda ao abrir a demonstração.
  purgeExpiredAnswers();
}

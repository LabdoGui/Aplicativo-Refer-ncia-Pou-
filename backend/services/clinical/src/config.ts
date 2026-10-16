import { serviceEnvSchema, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do clinical-service. */
export const envSchema = serviceEnvSchema;

export type ClinicalEnv = ServiceEnv;

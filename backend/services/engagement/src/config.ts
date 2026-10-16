import { serviceEnvSchema, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do engagement-service. */
export const envSchema = serviceEnvSchema;

export type EngagementEnv = ServiceEnv;

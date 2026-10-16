import { serviceEnvSchema, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do scheduling-service. */
export const envSchema = serviceEnvSchema;

export type SchedulingEnv = ServiceEnv;

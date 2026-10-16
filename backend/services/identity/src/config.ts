import { serviceEnvSchema, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do identity-service. */
export const envSchema = serviceEnvSchema;

export type IdentityEnv = ServiceEnv;

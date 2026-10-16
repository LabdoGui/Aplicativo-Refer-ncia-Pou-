import { serviceEnvSchema, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do notification-service. */
export const envSchema = serviceEnvSchema;

export type NotificationEnv = ServiceEnv;

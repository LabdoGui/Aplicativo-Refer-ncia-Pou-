import { serviceEnvSchema, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do inventory-service. */
export const envSchema = serviceEnvSchema;

export type InventoryEnv = ServiceEnv;

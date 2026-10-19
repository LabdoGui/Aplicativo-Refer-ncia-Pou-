import { serviceEnvSchema, z, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do notification-service. */
export const envSchema = serviceEnvSchema.extend({
  /** identity-service: administradores ativos para os alertas de estoque. */
  IDENTITY_URL: z.string().url(),
});

export type NotificationEnv = ServiceEnv & z.infer<typeof envSchema>;

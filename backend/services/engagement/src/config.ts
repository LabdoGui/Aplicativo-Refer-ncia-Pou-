import { serviceEnvSchema, z, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do engagement-service. */
export const envSchema = serviceEnvSchema.extend({
  /** identity-service, para os nomes dos doadores na revisão de horas (rota interna). */
  IDENTITY_URL: z.string().url(),
});

export type EngagementEnv = ServiceEnv & z.infer<typeof envSchema>;

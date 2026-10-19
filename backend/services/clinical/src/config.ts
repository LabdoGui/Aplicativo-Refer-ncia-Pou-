import { fieldEncryptionKeySchema, serviceEnvSchema, z, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do clinical-service. */
export const envSchema = serviceEnvSchema.extend({
  FIELD_ENCRYPTION_KEY: fieldEncryptionKeySchema,
  SCHEDULING_URL: z.string().url(),
  IDENTITY_URL: z.string().url(),
  /** Endereço público do app, usado no QR code dos documentos (verificação). */
  PUBLIC_APP_URL: z.string().url().default('http://localhost:8080'),
});

export type ClinicalEnv = ServiceEnv & z.infer<typeof envSchema>;

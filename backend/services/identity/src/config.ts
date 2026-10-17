import { fieldEncryptionKeySchema, serviceEnvSchema, z, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do identity-service. */
export const envSchema = serviceEnvSchema.extend({
  FIELD_ENCRYPTION_KEY: fieldEncryptionKeySchema,
  /** Pasta do par de chaves RSA do JWT (gerado no primeiro boot; volume próprio no Docker). */
  JWT_KEYS_DIR: z.string().default('.keys'),
  /** Alternativa ao arquivo: chave privada PKCS#8 em PEM (ex.: vinda de um cofre). */
  JWT_PRIVATE_KEY: z.string().optional(),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  /**
   * Cookie do refresh token com a flag Secure. "true" em produção (HTTPS).
   * Em http://localhost os navegadores aceitam; na rede local por http, use "false".
   */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type IdentityEnv = ServiceEnv & z.infer<typeof envSchema>;

import { fieldEncryptionKeySchema, serviceEnvSchema, z, type ServiceEnv } from '@pulso/common';
import { PASSWORD_POLICY } from '@pulso/contracts';

/** Variável vazia (ex.: `${VAR:-}` no docker-compose) conta como não informada. */
const emptyAsUndefined = (value: unknown) => (value === '' ? undefined : value);

/** Variáveis de ambiente do identity-service. */
export const envSchema = serviceEnvSchema
  .extend({
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
    /**
     * Primeiro administrador de uma instalação sem dados de demonstração
     * (SEED_DEMO_DATA=false): criado no boot se ainda não houver nenhum. Troque a
     * senha no primeiro acesso.
     */
    BOOTSTRAP_ADMIN_EMAIL: z.preprocess(
      emptyAsUndefined,
      z.string().email().toLowerCase().optional(),
    ),
    BOOTSTRAP_ADMIN_PASSWORD: z.preprocess(
      emptyAsUndefined,
      z
        .string()
        .min(PASSWORD_POLICY.minLength)
        .max(PASSWORD_POLICY.maxLength)
        .regex(PASSWORD_POLICY.pattern, PASSWORD_POLICY.message)
        .optional(),
    ),
  })
  .refine((env) => Boolean(env.BOOTSTRAP_ADMIN_EMAIL) === Boolean(env.BOOTSTRAP_ADMIN_PASSWORD), {
    message: 'Informe BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD juntos.',
  });

export type IdentityEnv = ServiceEnv & z.infer<typeof envSchema>;

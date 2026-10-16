import { z } from 'zod';

/**
 * Reexporta o Zod usado pelos schemas de ambiente, para que cada processo
 * estenda `baseEnvSchema`/`serviceEnvSchema` com a mesma instância e sem
 * declarar o Zod como dependência própria.
 */
export { z };

/** Variáveis de ambiente que todo processo do back-end precisa. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  /** Segredo compartilhado das rotas /internal (rede interna). */
  INTERNAL_API_TOKEN: z.string().min(16, 'deve ter ao menos 16 caracteres'),
  /** Onde buscar as chaves públicas do identity-service. */
  JWKS_URL: z.string().url(),
});

/** Variáveis adicionais de um serviço de domínio (banco + broker). */
export const serviceEnvSchema = baseEnvSchema.extend({
  DATABASE_URL: z.string().startsWith('postgresql://'),
  RABBITMQ_URL: z.string().startsWith('amqp'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type ServiceEnv = z.infer<typeof serviceEnvSchema>;

/**
 * Valida as variáveis de ambiente e falha cedo, com uma mensagem legível,
 * se algo estiver faltando ou inválido.
 */
export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuração inválida: ${issues}`);
  }
  return parsed.data;
}

import { baseEnvSchema, z } from '@pulso/common';

const DEFAULT_CORS_ORIGINS = 'http://localhost:5173,http://localhost:8080';

/** Lista separada por vírgulas → array de URLs de origem permitidas. */
const originList = z
  .string()
  .default(DEFAULT_CORS_ORIGINS)
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.string().url('cada origem deve ser uma URL válida')));

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/** Variáveis de ambiente do gateway. */
export const envSchema = baseEnvSchema.extend({
  IDENTITY_URL: z.string().url(),
  SCHEDULING_URL: z.string().url(),
  CLINICAL_URL: z.string().url(),
  INVENTORY_URL: z.string().url(),
  ENGAGEMENT_URL: z.string().url(),
  NOTIFICATION_URL: z.string().url(),
  CORS_ORIGINS: originList,
  RATE_LIMIT_WINDOW_MS: positiveInt(60_000),
  RATE_LIMIT_MAX: positiveInt(300),
  AUTH_RATE_LIMIT_MAX: positiveInt(20),
});

export type GatewayEnv = z.infer<typeof envSchema>;

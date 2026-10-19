import { serviceEnvSchema, z, type ServiceEnv } from '@pulso/common';

/** Variáveis de ambiente do scheduling-service. */
export const envSchema = serviceEnvSchema.extend({
  /** identity-service: nomes e resumos dos doadores na agenda da equipe. */
  IDENTITY_URL: z.string().url(),
  /**
   * SÓ PARA DEMONSTRAÇÃO: permite o check-in de agendamentos de dias futuros,
   * para percorrer a jornada inteira (agendar → atender → doar) numa sessão.
   * Fora do ambiente acadêmico, mantenha "false": o check-in vale só no dia.
   */
  DEMO_EARLY_CHECK_IN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type SchedulingEnv = ServiceEnv & z.infer<typeof envSchema>;

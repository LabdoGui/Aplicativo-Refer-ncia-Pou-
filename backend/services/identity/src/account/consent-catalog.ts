import type { ConsentPurpose } from '@pulso/contracts';

/** Texto de cada finalidade, exibido na tela de privacidade. */
export const CONSENT_CATALOG: Record<
  ConsentPurpose,
  { title: string; description: string; required: boolean }
> = {
  TERMS_PRIVACY: {
    title: 'Termos de Uso e Política de Privacidade',
    description:
      'Necessário para usar o SangueConecta: tratamos seus dados de cadastro para agendar doações e registrar seu histórico.',
    required: true,
  },
  COMMUNICATIONS: {
    title: 'Lembretes e comunicações',
    description:
      'Receber lembretes de agendamento e avisos de campanhas. Você pode desativar quando quiser.',
    required: false,
  },
};

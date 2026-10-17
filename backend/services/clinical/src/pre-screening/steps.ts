import type { PreScreeningStep } from '@pulso/contracts';

/** Títulos das 6 etapas da pré-triagem (as perguntas ficam no banco, versionadas). */
export const PRE_SCREENING_STEPS: PreScreeningStep[] = [
  { step: 1, title: 'Sobre você', description: 'Algumas informações gerais para começar.' },
  { step: 2, title: 'Como você está hoje', description: 'Como você se sente neste momento.' },
  {
    step: 3,
    title: 'Alimentação e hábitos',
    description: 'Alimentação, descanso e bebidas antes da doação.',
  },
  { step: 4, title: 'Saúde recente', description: 'Sintomas e medicamentos dos últimos dias.' },
  { step: 5, title: 'Procedimentos', description: 'Procedimentos feitos nos últimos meses.' },
  { step: 6, title: 'Doações anteriores', description: 'Seu histórico de doações de sangue.' },
];

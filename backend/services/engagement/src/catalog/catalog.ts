import type { AchievementCode, AchievementCriteria } from '@pulso/contracts';
import type { RuleSettings } from '../rules/engagement-rules';

/** Parâmetros padrão da gamificação (D4). Ajustáveis pelo administrador. */
export const DEFAULT_SETTINGS: RuleSettings & { rankingEnabled: boolean } = {
  pointsBasis: 'ATTENDANCE',
  firstPoints: 100,
  recurringPoints: 150,
  campaignPoints: 50,
  rankingEnabled: true,
};

/** Catálogo inicial de conquistas (contam doações concluídas, D4). */
export const ACHIEVEMENT_CATALOG: Array<{
  code: AchievementCode;
  name: string;
  description: string;
  criteria: AchievementCriteria;
  threshold: number;
  order: number;
}> = [
  {
    code: 'FIRST_DONATION',
    name: 'Primeira Doação',
    description: 'Você concluiu sua primeira doação de sangue. Obrigado por começar!',
    criteria: 'DONATION_COUNT',
    threshold: 1,
    order: 1,
  },
  {
    code: 'RECURRING_DONOR',
    name: 'Doador Recorrente',
    description: 'Voltou para doar de novo: a regularidade é o que mantém o estoque estável.',
    criteria: 'DONATION_COUNT',
    threshold: 2,
    order: 2,
  },
  {
    code: 'THREE_DONATIONS',
    name: '3 Doações',
    description: 'Três doações concluídas. Você já faz parte da rotina do hemocentro.',
    criteria: 'DONATION_COUNT',
    threshold: 3,
    order: 3,
  },
  {
    code: 'FIVE_DONATIONS',
    name: '5 Doações',
    description: 'Cinco doações concluídas. Um compromisso de longo prazo com a comunidade.',
    criteria: 'DONATION_COUNT',
    threshold: 5,
    order: 4,
  },
  {
    code: 'CAMPAIGN_SPECIAL',
    name: 'Campanha Especial',
    description: 'Doou durante uma campanha, quando o estoque mais precisava.',
    criteria: 'CAMPAIGN_DONATION',
    threshold: 1,
    order: 5,
  },
];

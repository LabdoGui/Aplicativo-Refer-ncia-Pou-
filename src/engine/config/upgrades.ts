/**
 * Melhorias do jogador. Conteúdo puramente declarativo:
 * para adicionar uma melhoria basta incluir um item aqui e (se for um efeito novo)
 * tratá-lo em economy.ts.
 */
export type UpgradeEffect =
  | { kind: 'clickFlat'; cents: number } // + centavos por clique, por nível
  | { kind: 'clickMult'; factor: number } // multiplica o clique, por nível
  | { kind: 'clickFromPassive'; fraction: number } // clique ganha X da renda/s, por nível
  | { kind: 'passiveFlat'; centsPerSecond: number } // renda automática, por nível
  | { kind: 'passiveMult'; fraction: number } // + % em toda renda passiva, por nível
  | { kind: 'expenseReduction'; fraction: number } // - % despesas operacionais, por nível
  | { kind: 'autoClick'; perSecond: number }; // cliques automáticos por segundo, por nível

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number; // centavos
  growth: number;
  maxLevel: number;
  effect: UpgradeEffect;
  /** Patrimônio líquido (centavos) a partir do qual a melhoria aparece. */
  unlockNetWorth: number;
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'clique',
    name: 'Clique aprimorado',
    icon: '👆',
    description: '+R$ 1,00 por clique a cada nível.',
    baseCost: 1_500,
    growth: 1.16,
    maxLevel: 200,
    effect: { kind: 'clickFlat', cents: 100 },
    unlockNetWorth: 0,
  },
  {
    id: 'robo',
    name: 'Robô investidor',
    icon: '🤖',
    description: 'Gera R$ 0,40 por segundo por nível, mesmo sem você clicar.',
    baseCost: 2_500,
    growth: 1.15,
    maxLevel: 300,
    effect: { kind: 'passiveFlat', centsPerSecond: 40 },
    unlockNetWorth: 0,
  },
  {
    id: 'platinum',
    name: 'Cartão Platinum',
    icon: '💳',
    description: 'Dobra o valor de cada clique (por nível).',
    baseCost: 100_000,
    growth: 15,
    maxLevel: 6,
    effect: { kind: 'clickMult', factor: 2 },
    unlockNetWorth: 50_000,
  },
  {
    id: 'gerador',
    name: 'Gerador automático de renda',
    icon: '⚙️',
    description: 'Renda automática de R$ 6,00 por segundo por nível.',
    baseCost: 120_000,
    growth: 1.17,
    maxLevel: 300,
    effect: { kind: 'passiveFlat', centsPerSecond: 600 },
    unlockNetWorth: 30_000,
  },
  {
    id: 'clique_inteligente',
    name: 'Clique inteligente',
    icon: '🧠',
    description: 'Cada clique também rende 1% da sua renda passiva por segundo (por nível).',
    baseCost: 400_000,
    growth: 6,
    maxLevel: 5,
    effect: { kind: 'clickFromPassive', fraction: 0.01 },
    unlockNetWorth: 100_000,
  },
  {
    id: 'automacao',
    name: 'Automação de negócios',
    icon: '🦾',
    description: 'Um clique automático por segundo, por nível. Chega de clicar sem parar.',
    baseCost: 1_000_000,
    growth: 5,
    maxLevel: 5,
    effect: { kind: 'autoClick', perSecond: 1 },
    unlockNetWorth: 300_000,
  },
  {
    id: 'consultor',
    name: 'Consultor financeiro',
    icon: '📊',
    description: '+5% em toda renda passiva por nível.',
    baseCost: 2_500_000,
    growth: 1.9,
    maxLevel: 20,
    effect: { kind: 'passiveMult', fraction: 0.05 },
    unlockNetWorth: 1_000_000,
  },
  {
    id: 'gestao',
    name: 'Equipe de gestão',
    icon: '🧑‍💼',
    description: '-3% nas despesas operacionais dos negócios por nível (máx. 10).',
    baseCost: 5_000_000,
    growth: 2.1,
    maxLevel: 10,
    effect: { kind: 'expenseReduction', fraction: 0.03 },
    unlockNetWorth: 2_000_000,
  },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

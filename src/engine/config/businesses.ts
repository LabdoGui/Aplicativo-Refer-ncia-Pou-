import type { RiskLevel, Sector } from '../types';

export interface BusinessDef {
  id: string;
  name: string;
  icon: string;
  sector: Sector;
  description: string;
  /** Diferencial estratégico explicado ao jogador. */
  trait: string;
  risk: RiskLevel;
  /** Preço de aquisição (nível 1), em centavos. */
  baseCost: number;
  /** Crescimento do custo por nível. */
  growth: number;
  /** Receita bruta por segundo no nível 1, em centavos. */
  baseRevenue: number;
  /** Fração da receita consumida por despesas operacionais. */
  expenseRatio: number;
  /** Patrimônio líquido (centavos) necessário para liberar a compra. */
  unlockNetWorth: number;
  /** Funcionários por nível (indicador de capacidade operacional). */
  staffPerLevel: number;
  /** Reduz pela metade impactos negativos de eventos (negócio defensivo). */
  defensive?: boolean;
  /** Amplifica impactos de eventos (positivos e negativos). */
  eventSensitivity?: number;
  /** Bônus de receita para todos os OUTROS negócios, por nível (holding). */
  groupBonusPerLevel?: number;
  maxLevel: number;
}

export const BUSINESSES: readonly BusinessDef[] = [
  {
    id: 'loja',
    name: 'Loja virtual',
    icon: '🛒',
    sector: 'varejo',
    description: 'E-commerce enxuto. Barato de abrir, margem boa.',
    trait: 'Sensível à demanda do consumidor: ganha muito em booms de consumo e sofre em crises.',
    risk: 'médio',
    baseCost: 5_000,
    growth: 1.15,
    baseRevenue: 50,
    expenseRatio: 0.3,
    unlockNetWorth: 0,
    staffPerLevel: 1,
    eventSensitivity: 1.3,
    maxLevel: 500,
  },
  {
    id: 'restaurante',
    name: 'Restaurante',
    icon: '🍽️',
    sector: 'alimentacao',
    description: 'Movimento constante, mas cozinha e salão custam caro.',
    trait: 'Despesas altas (55%), porém receita muito estável e pouco afetada por eventos.',
    risk: 'baixo',
    baseCost: 75_000,
    growth: 1.15,
    baseRevenue: 500,
    expenseRatio: 0.55,
    unlockNetWorth: 25_000,
    staffPerLevel: 4,
    defensive: true,
    maxLevel: 500,
  },
  {
    id: 'tecnologia',
    name: 'Empresa de tecnologia',
    icon: '💻',
    sector: 'tecnologia',
    description: 'Software escalável com margens altas.',
    trait: 'Custo de expansão cresce rápido, mas dispara em avanços tecnológicos. Alto risco em crises.',
    risk: 'alto',
    baseCost: 1_000_000,
    growth: 1.18,
    baseRevenue: 5_000,
    expenseRatio: 0.35,
    unlockNetWorth: 300_000,
    staffPerLevel: 3,
    eventSensitivity: 1.6,
    maxLevel: 400,
  },
  {
    id: 'supermercado',
    name: 'Rede de supermercados',
    icon: '🏪',
    sector: 'alimentacao',
    description: 'Volume gigante com margem apertada.',
    trait: 'Defensivo: quase não sente crises. Margem baixa (70% de despesas) — gestão faz muita diferença.',
    risk: 'baixo',
    baseCost: 12_000_000,
    growth: 1.14,
    baseRevenue: 40_000,
    expenseRatio: 0.7,
    unlockNetWorth: 4_000_000,
    staffPerLevel: 25,
    defensive: true,
    maxLevel: 500,
  },
  {
    id: 'transportadora',
    name: 'Transportadora',
    icon: '🚚',
    sector: 'logistica',
    description: 'Frota e rotas que movem a economia.',
    trait: 'Combustível pesa: sofre com alta de energia. Galpões reduzem despesas em 10%.',
    risk: 'médio',
    baseCost: 150_000_000,
    growth: 1.16,
    baseRevenue: 375_000,
    expenseRatio: 0.5,
    unlockNetWorth: 50_000_000,
    staffPerLevel: 12,
    maxLevel: 500,
  },
  {
    id: 'construtora',
    name: 'Construtora',
    icon: '🏗️',
    sector: 'construcao',
    description: 'Obras residenciais e comerciais.',
    trait: 'Acompanha o ciclo imobiliário. Ter terrenos aumenta a receita em 15%.',
    risk: 'alto',
    baseCost: 2_000_000_000,
    growth: 1.17,
    baseRevenue: 3_333_333,
    expenseRatio: 0.5,
    unlockNetWorth: 600_000_000,
    staffPerLevel: 40,
    eventSensitivity: 1.4,
    maxLevel: 400,
  },
  {
    id: 'banco',
    name: 'Banco',
    icon: '🏦',
    sector: 'financeiro',
    description: 'Crédito, contas e investimentos.',
    trait: 'Lucra com juros altos e perde com juros baixos. Despesas baixas.',
    risk: 'médio',
    baseCost: 25_000_000_000,
    growth: 1.17,
    baseRevenue: 31_250_000,
    expenseRatio: 0.3,
    unlockNetWorth: 8_000_000_000,
    staffPerLevel: 30,
    maxLevel: 400,
  },
  {
    id: 'mineradora',
    name: 'Mineradora',
    icon: '⛏️',
    sector: 'mineracao',
    description: 'Extração de minérios com ciclos de preço.',
    trait: 'Muito cíclica: alterna fases ótimas e ruins conforme o mercado de commodities.',
    risk: 'alto',
    baseCost: 300_000_000_000,
    growth: 1.18,
    baseRevenue: 272_727_273,
    expenseRatio: 0.45,
    unlockNetWorth: 100_000_000_000,
    staffPerLevel: 80,
    eventSensitivity: 1.5,
    maxLevel: 400,
  },
  {
    id: 'energia',
    name: 'Empresa de energia',
    icon: '⚡',
    sector: 'energia',
    description: 'Geração e distribuição de eletricidade.',
    trait: 'Receita previsível e defensiva; ganha em alta do setor de energia.',
    risk: 'baixo',
    baseCost: 4_000_000_000_000,
    growth: 1.15,
    baseRevenue: 2_670_000_000,
    expenseRatio: 0.4,
    unlockNetWorth: 1_300_000_000_000,
    staffPerLevel: 60,
    defensive: true,
    maxLevel: 500,
  },
  {
    id: 'telecom',
    name: 'Operadora de telecom',
    icon: '📡',
    sector: 'telecom',
    description: 'Internet e telefonia para milhões de clientes.',
    trait: 'Grande e estável, beneficiada por avanços tecnológicos.',
    risk: 'médio',
    baseCost: 50_000_000_000_000,
    growth: 1.16,
    baseRevenue: 25_000_000_000,
    expenseRatio: 0.4,
    unlockNetWorth: 16_000_000_000_000,
    staffPerLevel: 100,
    maxLevel: 500,
  },
  {
    id: 'holding',
    name: 'Holding empresarial',
    icon: '🏛️',
    sector: 'conglomerado',
    description: 'Controla e otimiza todo o seu grupo.',
    trait: 'Renda própria modesta, mas cada nível dá +1% de receita a todos os outros negócios. Exige um escritório ou prédio comercial.',
    risk: 'médio',
    baseCost: 700_000_000_000_000,
    growth: 1.25,
    baseRevenue: 140_000_000_000,
    expenseRatio: 0.2,
    unlockNetWorth: 200_000_000_000_000,
    staffPerLevel: 20,
    groupBonusPerLevel: 0.01,
    maxLevel: 300,
  },
];

export const BUSINESS_BY_ID: Record<string, BusinessDef> = Object.fromEntries(BUSINESSES.map((b) => [b.id, b]));

/** Regras de expansão comuns a todos os negócios. */
export const BUSINESS_RULES = {
  maxMarketing: 10,
  marketingBonus: 0.1,
  marketingCostFactor: 0.5, // custo = baseCost * fator * 2^nível
  maxBranches: 5,
  branchLevelStep: 10, // filial N exige nível 10*N
  branchCostFactor: 5, // custo = baseCost * 5 * 3^filiais
  competitorLevel: 25,
  competitorCostFactor: 40,
  competitorBonus: 0.5,
};

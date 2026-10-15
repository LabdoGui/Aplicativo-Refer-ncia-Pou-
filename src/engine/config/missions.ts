import { ASSET_BY_ID } from './assets';
import { BUSINESSES } from './businesses';
import type { GameState } from '../types';

/** Contexto calculado uma vez e passado às verificações (evita recalcular patrimônio). */
export interface ProgressContext {
  netWorth: bigint;
  passiveNet: number; // centavos/s
}

export type MissionTier = 'tutorial' | 'curto' | 'medio' | 'longo';

export interface MissionDef {
  id: string;
  tier: MissionTier;
  title: string;
  description: string;
  /** Aba onde a ação acontece (para o botão "Ir"). */
  tab: TabId;
  /** Progresso atual e meta (números para barra de progresso). */
  progress: (s: GameState, c: ProgressContext) => [number, number];
  /** Recompensa em centavos. Pequena o bastante para não quebrar a economia. */
  reward: number;
}

export type TabId = 'inicio' | 'negocios' | 'bolsa' | 'cripto' | 'imoveis' | 'patrimonio' | 'missoes' | 'conquistas';

const businessesOwned = (s: GameState) => Object.values(s.businesses).filter((b) => b.level > 0).length;
const stocksOwned = (s: GameState, kind?: 'crypto') =>
  Object.keys(s.portfolio).filter((id) => (kind === 'crypto') === (ASSET_BY_ID[id]?.kind === 'crypto')).length;
const propertiesOwned = (s: GameState) => Object.values(s.realEstate.holdings).reduce((a, h) => a + h.units, 0);
const reais = (c: number | bigint) => Number(c) / 100;
const upg = (s: GameState, id: string) => s.upgrades[id] ?? 0;

export const MISSIONS: readonly MissionDef[] = [
  // ---- Tutorial (sequencial) ----
  {
    id: 't1', tier: 'tutorial', tab: 'inicio',
    title: 'Toque no cartão',
    description: 'Clique no cartão 10 vezes para ganhar seus primeiros reais.',
    progress: (s) => [s.stats.clicks, 10], reward: 500,
  },
  {
    id: 't2', tier: 'tutorial', tab: 'inicio',
    title: 'Primeira melhoria',
    description: 'Compre um "Clique aprimorado" ou um "Robô investidor" na lista de melhorias.',
    progress: (s) => [Math.min(1, upg(s, 'clique') + upg(s, 'robo')), 1], reward: 1_000,
  },
  {
    id: 't3', tier: 'tutorial', tab: 'negocios',
    title: 'Abra seu primeiro negócio',
    description: 'Na aba Negócios, compre a Loja virtual. Negócios geram renda sozinhos.',
    progress: (s) => [Math.min(1, businessesOwned(s)), 1], reward: 3_000,
  },
  {
    id: 't4', tier: 'tutorial', tab: 'bolsa',
    title: 'Faça seu primeiro investimento',
    description: 'Compre qualquer ação na Bolsa. Algumas pagam dividendos.',
    progress: (s) => [Math.min(1, stocksOwned(s)), 1], reward: 5_000,
  },
  {
    id: 't5', tier: 'tutorial', tab: 'patrimonio',
    title: 'Entenda suas finanças',
    description: 'Abra a aba Patrimônio e veja receitas, despesas e patrimônio líquido. (Conclui ao ter renda passiva líquida de R$ 2/s.)',
    progress: (_s, c) => [Math.min(reais(c.passiveNet), 2), 2], reward: 8_000,
  },
  {
    id: 't6', tier: 'tutorial', tab: 'bolsa',
    title: 'Diversifique',
    description: 'Tenha 3 ativos diferentes (ações ou criptomoedas) ao mesmo tempo.',
    progress: (s) => [Math.min(3, Object.keys(s.portfolio).length), 3], reward: 20_000,
  },
  // ---- Curto prazo ----
  {
    id: 'c1', tier: 'curto', tab: 'inicio',
    title: 'Primeiros R$ 1.000',
    description: 'Atinja R$ 1.000 de patrimônio líquido.',
    progress: (_s, c) => [Math.min(reais(c.netWorth), 1_000), 1_000], reward: 10_000,
  },
  {
    id: 'c2', tier: 'curto', tab: 'negocios',
    title: 'Contrate um gerente',
    description: 'Gerentes fazem o negócio operar a 100% (sem gerente: 60%).',
    progress: (s) => [Math.min(1, Object.values(s.businesses).filter((b) => b.manager).length), 1], reward: 15_000,
  },
  {
    id: 'c3', tier: 'curto', tab: 'patrimonio',
    title: 'Renda passiva de R$ 50/s',
    description: 'Some negócios, robôs e aluguéis até R$ 50 por segundo líquidos.',
    progress: (_s, c) => [Math.min(reais(c.passiveNet), 50), 50], reward: 50_000,
  },
  {
    id: 'c4', tier: 'curto', tab: 'bolsa',
    title: 'Operação lucrativa',
    description: 'Venda um ativo com lucro (depois das taxas).',
    progress: (s) => [Math.min(1, s.stats.profitableTrades), 1], reward: 30_000,
  },
  {
    id: 'c5', tier: 'curto', tab: 'imoveis',
    title: 'Primeiro imóvel',
    description: 'Compre um imóvel na aba Imóveis.',
    progress: (s) => [Math.min(1, propertiesOwned(s)), 1], reward: 100_000,
  },
  // ---- Médio prazo ----
  {
    id: 'm1', tier: 'medio', tab: 'negocios',
    title: 'Grupo empresarial',
    description: 'Possua 5 tipos de negócio diferentes.',
    progress: (s) => [Math.min(5, businessesOwned(s)), 5], reward: 2_000_000,
  },
  {
    id: 'm2', tier: 'medio', tab: 'negocios',
    title: 'Primeira filial',
    description: 'Abra uma filial de qualquer negócio (exige nível 10).',
    progress: (s) => [Math.min(1, Object.values(s.businesses).reduce((a, b) => a + b.branches, 0)), 1], reward: 500_000,
  },
  {
    id: 'm3', tier: 'medio', tab: 'patrimonio',
    title: 'Sobreviva a uma crise',
    description: 'Atravesse uma crise econômica até o fim com seus negócios funcionando.',
    progress: (s) => [Math.min(1, s.stats.crisesSurvived), 1], reward: 1_000_000,
  },
  {
    id: 'm4', tier: 'medio', tab: 'inicio',
    title: 'Milionário',
    description: 'Atinja R$ 1 milhão de patrimônio líquido.',
    progress: (_s, c) => [Math.min(reais(c.netWorth), 1e6), 1e6], reward: 5_000_000,
  },
  {
    id: 'm5', tier: 'medio', tab: 'imoveis',
    title: 'Incorporador',
    description: 'Desenvolva um terreno até virar prédio comercial.',
    progress: (s) => [Math.min(1, s.realEstate.holdings['predio']?.units ?? 0), 1], reward: 20_000_000,
  },
  // ---- Longo prazo ----
  {
    id: 'l1', tier: 'longo', tab: 'negocios',
    title: 'Construa uma holding',
    description: 'Funde a Holding empresarial (exige escritório ou prédio comercial).',
    progress: (s) => [Math.min(1, s.businesses['holding']?.level ?? 0), 1], reward: 100_000_000_000,
  },
  {
    id: 'l2', tier: 'longo', tab: 'inicio',
    title: 'Bilionário',
    description: 'Atinja R$ 1 bilhão de patrimônio líquido.',
    progress: (_s, c) => [Math.min(reais(c.netWorth), 1e9), 1e9], reward: 5_000_000_000,
  },
  {
    id: 'l3', tier: 'longo', tab: 'negocios',
    title: 'Conglomerado completo',
    description: `Possua todos os ${BUSINESSES.length} tipos de negócio.`,
    progress: (s) => [businessesOwned(s), BUSINESSES.length], reward: 500_000_000_000,
  },
  {
    id: 'l4', tier: 'longo', tab: 'patrimonio',
    title: 'Legado',
    description: 'Faça seu primeiro reinício de Legado (prestígio).',
    progress: (s) => [Math.min(1, s.prestige.resets), 1], reward: 0,
  },
];

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  rare?: boolean;
  check: (s: GameState, c: ProgressContext) => boolean;
}

const nw = (c: ProgressContext, reaisValue: number) => c.netWorth >= BigInt(Math.round(reaisValue * 100));

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'a_click100', name: 'Dedo nervoso', icon: '👆', description: '100 cliques.', check: (s) => s.stats.clicks >= 100 },
  { id: 'a_click1000', name: 'Clicador profissional', icon: '🖱️', description: '1.000 cliques.', check: (s) => s.stats.clicks >= 1000 },
  { id: 'a_nw10k', name: 'Reserva de emergência', icon: '🐷', description: 'Patrimônio de R$ 10 mil.', check: (_s, c) => nw(c, 1e4) },
  { id: 'a_nw1m', name: 'Primeiro milhão', icon: '💰', description: 'Patrimônio de R$ 1 milhão.', check: (_s, c) => nw(c, 1e6) },
  { id: 'a_nw1b', name: 'Bilionário', icon: '💎', description: 'Patrimônio de R$ 1 bilhão.', check: (_s, c) => nw(c, 1e9) },
  { id: 'a_nw1t', name: 'Trilionário', icon: '👑', description: 'Patrimônio de R$ 1 trilhão.', rare: true, check: (_s, c) => nw(c, 1e12) },
  { id: 'a_biz3', name: 'Empreendedor', icon: '🏪', description: '3 negócios diferentes.', check: (s) => businessesOwned(s) >= 3 },
  { id: 'a_lvl100', name: 'Centenário', icon: '💯', description: 'Um negócio no nível 100.', check: (s) => Object.values(s.businesses).some((b) => b.level >= 100) },
  { id: 'a_mgr5', name: 'Delegar é preciso', icon: '🧑‍💼', description: '5 gerentes contratados.', check: (s) => Object.values(s.businesses).filter((b) => b.manager).length >= 5 },
  { id: 'a_trade10', name: 'Trader', icon: '📈', description: '10 vendas com lucro.', check: (s) => s.stats.profitableTrades >= 10 },
  { id: 'a_div', name: 'Vivendo de renda', icon: '🧾', description: 'Receba R$ 10 mil em dividendos.', check: (s) => s.dividendsReceived >= 1_000_000n },
  { id: 'a_crypto3', name: 'Cripto-curioso', icon: '🪙', description: '3 criptomoedas na carteira.', check: (s) => stocksOwned(s, 'crypto') >= 3 },
  { id: 'a_prop10', name: 'Senhorio', icon: '🔑', description: '10 imóveis.', check: (s) => propertiesOwned(s) >= 10 },
  { id: 'a_crisis3', name: 'Casca grossa', icon: '🛡️', description: 'Sobreviva a 3 crises.', check: (s) => s.stats.crisesSurvived >= 3 },
  { id: 'a_passive1k', name: 'Máquina de dinheiro', icon: '⚙️', description: 'Renda passiva líquida de R$ 1.000/s.', check: (_s, c) => c.passiveNet >= 100_000 },
  { id: 'a_luxo', name: 'Alto padrão', icon: '🏝️', description: 'Possua um resort de luxo.', rare: true, check: (s) => (s.realEstate.holdings['luxo']?.units ?? 0) > 0 },
  { id: 'a_prestige', name: 'Dinastia', icon: '🏛️', description: 'Reinicie com Legado pela primeira vez.', rare: true, check: (s) => s.prestige.resets >= 1 },
];

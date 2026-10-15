import type { Sector } from '../types';

export interface EventEffects {
  /** Multiplicador de receita de negócios por setor (1.2 = +20%). */
  businessRevenue?: Partial<Record<Sector, number>>;
  /** Multiplicador de despesas de negócios por setor. */
  businessExpense?: Partial<Record<Sector, number>>;
  /** Tendência extra de preço por passo de mercado, por setor de ativo. */
  assetDrift?: Partial<Record<Sector, number>>;
  /** Tendência extra de valorização por passo imobiliário, por região ('*' = todas). */
  regionDrift?: Record<string, number>;
  /** Multiplicador de aluguéis. */
  rentMultiplier?: number;
}

export interface EventDef {
  id: string;
  name: string;
  icon: string;
  tone: 'good' | 'bad' | 'mixed';
  description: string;
  /** Como o jogador pode se preparar ou aproveitar. */
  advice: string;
  durationMs: number;
  weight: number;
  effects: EventEffects;
  /** Conta como crise para a missão "Sobreviver a uma crise". */
  isCrisis?: boolean;
}

export const EVENTS: readonly EventDef[] = [
  {
    id: 'crise',
    name: 'Crise econômica',
    icon: '📉',
    tone: 'bad',
    description: 'Consumo despenca e o crédito trava. Varejo, tecnologia e construção sofrem; setores defensivos aguentam.',
    advice: 'Negócios defensivos (restaurante, supermercado, energia) e a moeda estável protegem o caixa. Ações baratas podem ser oportunidade.',
    durationMs: 180_000,
    weight: 2,
    isCrisis: true,
    effects: {
      businessRevenue: { varejo: 0.7, tecnologia: 0.75, construcao: 0.7, logistica: 0.85, financeiro: 0.85, mineracao: 0.8 },
      assetDrift: { varejo: -0.003, tecnologia: -0.004, construcao: -0.004, financeiro: -0.002, mineracao: -0.003, cripto: -0.004, logistica: -0.002 },
      regionDrift: { '*': -0.004 },
    },
  },
  {
    id: 'juros_baixos',
    name: 'Queda de juros',
    icon: '🏷️',
    tone: 'mixed',
    description: 'Crédito barato aquece consumo e imóveis, mas reduz a margem dos bancos.',
    advice: 'Bom momento para imóveis e construção. Bancos rendem menos durante o período.',
    durationMs: 240_000,
    weight: 3,
    effects: {
      businessRevenue: { construcao: 1.25, varejo: 1.1, financeiro: 0.85 },
      assetDrift: { construcao: 0.003, varejo: 0.0015, financeiro: -0.0015 },
      regionDrift: { '*': 0.003 },
    },
  },
  {
    id: 'juros_altos',
    name: 'Juros em alta',
    icon: '🏦',
    tone: 'mixed',
    description: 'O banco central fictício sobe juros para conter preços. Bancos lucram; construção desacelera.',
    advice: 'Bancos e ações financeiras se beneficiam. Evite comprar imóveis caros agora.',
    durationMs: 240_000,
    weight: 3,
    effects: {
      businessRevenue: { financeiro: 1.3, construcao: 0.8 },
      assetDrift: { financeiro: 0.002, construcao: -0.002 },
      regionDrift: { '*': -0.002 },
    },
  },
  {
    id: 'inflacao',
    name: 'Inflação elevada',
    icon: '🔥',
    tone: 'bad',
    description: 'Custos sobem para todos: despesas operacionais +15%. Aluguéis são reajustados.',
    advice: 'Equipe de gestão reduz o impacto. Imóveis protegem: aluguéis sobem 10%.',
    durationMs: 200_000,
    weight: 2,
    effects: {
      businessExpense: {
        varejo: 1.15, alimentacao: 1.15, tecnologia: 1.15, logistica: 1.15, construcao: 1.15,
        financeiro: 1.15, mineracao: 1.15, energia: 1.15, telecom: 1.15, conglomerado: 1.15,
      },
      rentMultiplier: 1.1,
      assetDrift: { mineracao: 0.001 },
    },
  },
  {
    id: 'energia_alta',
    name: 'Alta no setor de energia',
    icon: '⚡',
    tone: 'mixed',
    description: 'Preço da energia dispara. Geradoras lucram; transporte e indústria pagam mais caro.',
    advice: 'Ações e empresas de energia sobem. Transportadoras ficam mais caras de operar.',
    durationMs: 200_000,
    weight: 3,
    effects: {
      businessRevenue: { energia: 1.4 },
      businessExpense: { logistica: 1.3, mineracao: 1.1 },
      assetDrift: { energia: 0.003, logistica: -0.002 },
    },
  },
  {
    id: 'tech',
    name: 'Avanço tecnológico',
    icon: '🚀',
    tone: 'good',
    description: 'Uma nova onda de inovação aumenta a demanda por software e conectividade.',
    advice: 'Tecnologia e telecom disparam. Momento para expandir empresas de tecnologia.',
    durationMs: 240_000,
    weight: 3,
    effects: {
      businessRevenue: { tecnologia: 1.5, telecom: 1.2 },
      assetDrift: { tecnologia: 0.004, telecom: 0.002, cripto: 0.002 },
    },
  },
  {
    id: 'falencia',
    name: 'Falência de concorrente',
    icon: '💥',
    tone: 'good',
    description: 'Uma grande rede varejista fictícia quebrou. Seus clientes migram para os concorrentes.',
    advice: 'Varejo e alimentação ganham mercado. Ótimo momento para investir em lojas.',
    durationMs: 180_000,
    weight: 2,
    effects: {
      businessRevenue: { varejo: 1.35, alimentacao: 1.15 },
      assetDrift: { varejo: 0.003, alimentacao: 0.001 },
    },
  },
  {
    id: 'boom_imob',
    name: 'Boom imobiliário',
    icon: '🏘️',
    tone: 'good',
    description: 'Procura por imóveis explode. Preços e aluguéis sobem; construtoras trabalham a todo vapor.',
    advice: 'Bom momento para VENDER imóveis valorizados ou desenvolver terrenos.',
    durationMs: 240_000,
    weight: 2,
    effects: {
      businessRevenue: { construcao: 1.4 },
      assetDrift: { construcao: 0.003 },
      regionDrift: { '*': 0.006 },
      rentMultiplier: 1.15,
    },
  },
  {
    id: 'consumo',
    name: 'Mudança no consumo',
    icon: '📱',
    tone: 'mixed',
    description: 'Consumidores migram das lojas físicas para o digital.',
    advice: 'Loja virtual e telecom ganham; supermercados perdem um pouco de movimento.',
    durationMs: 200_000,
    weight: 2,
    effects: {
      businessRevenue: { varejo: 1.3, telecom: 1.1, alimentacao: 0.9 },
      assetDrift: { varejo: 0.002, alimentacao: -0.001 },
    },
  },
  {
    id: 'commodities',
    name: 'Superciclo de commodities',
    icon: '⛏️',
    tone: 'good',
    description: 'Demanda global por minério dispara.',
    advice: 'Mineração lucra muito. Ações cíclicas tendem a subir — e a cair depois.',
    durationMs: 240_000,
    weight: 2,
    effects: {
      businessRevenue: { mineracao: 1.6, logistica: 1.1 },
      assetDrift: { mineracao: 0.004 },
      regionDrift: { industrial: 0.003 },
    },
  },
  {
    id: 'cripto_euforia',
    name: 'Euforia cripto',
    icon: '🪙',
    tone: 'mixed',
    description: 'Todo mundo fala de criptomoedas. Preços sobem rápido — bolhas costumam estourar.',
    advice: 'Lucros rápidos são possíveis, mas realize parte deles: euforias não duram.',
    durationMs: 150_000,
    weight: 2,
    effects: { assetDrift: { cripto: 0.008 } },
  },
  {
    id: 'cripto_inverno',
    name: 'Inverno cripto',
    icon: '❄️',
    tone: 'bad',
    description: 'Investidores fogem do risco e as criptomoedas despencam.',
    advice: 'Moeda estável protege. Quem tem paciência pode comprar barato.',
    durationMs: 180_000,
    weight: 2,
    effects: { assetDrift: { cripto: -0.007 } },
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

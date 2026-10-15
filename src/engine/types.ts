import type { Money } from './money';
import type { RngState } from './rng';

export type Sector =
  | 'varejo'
  | 'alimentacao'
  | 'tecnologia'
  | 'logistica'
  | 'construcao'
  | 'financeiro'
  | 'mineracao'
  | 'energia'
  | 'telecom'
  | 'conglomerado'
  | 'cripto'
  | 'imobiliario';

export type RiskLevel = 'baixo' | 'médio' | 'alto' | 'extremo';

export interface BusinessState {
  level: number;
  manager: boolean;
  marketing: number;
  branches: number;
  acquiredCompetitor: boolean;
  /** Total investido (para valor de revenda e auditoria). */
  invested: Money;
}

export interface Holding {
  qty: number;
  /** Custo total pago, incluindo taxas. Preço médio = costBasis / qty. */
  costBasis: Money;
}

export interface AssetState {
  price: Money;
  /** Valor "justo" para onde o preço tende a voltar (fundamento). */
  fundamental: number;
  /** Momento de curto prazo (log-retorno por passo). */
  momentum: number;
  /** Histórico de preços em centavos (para gráficos). */
  history: number[];
  /** Preço no início da janela de histórico (para variação %). */
  openPrice: number;
}

export interface NewsItem {
  id: number;
  at: number; // gameTime
  title: string;
  detail: string;
  tone: 'good' | 'bad' | 'neutral';
  assetId?: string;
}

export interface PropertyHolding {
  units: number;
  renovation: number;
  costBasis: Money;
}

export interface Development {
  id: number;
  fromDefId: string;
  toDefId: string;
  readyAt: number;
  /** Custo do terreno + obra (vira o custo do novo imóvel). */
  costBasis: Money;
}

export interface RegionState {
  index: number;
  phase: number;
  history: number[];
}

export interface ActiveEvent {
  defId: string;
  startsAt: number;
  endsAt: number;
}

export type LedgerCategory =
  | 'clique'
  | 'renda'
  | 'despesa'
  | 'melhoria'
  | 'negocio'
  | 'acao'
  | 'cripto'
  | 'imovel'
  | 'dividendo'
  | 'taxa'
  | 'recompensa'
  | 'offline'
  | 'divida'
  | 'sistema';

export interface LedgerEntry {
  id: number;
  at: number; // gameTime
  realAt: number; // Date.now() quando registrado
  category: LedgerCategory;
  description: string;
  /** Variação no saldo (positivo = entrada). */
  amount: Money;
  balanceAfter: Money;
  /** Detalhamento opcional (ex.: renda passiva por fonte). */
  breakdown?: Record<string, Money>;
}

/** Acumulador do fluxo de caixa passivo de um período. */
export interface FlowPeriod {
  start: number;
  end: number;
  /** Valores em centavos (fração permitida) por fonte. */
  sources: Record<string, number>;
  income: number;
  expenses: number;
  /** Valor exato creditado/debitado no saldo pela renda passiva no período. */
  credited: Money;
  /** Total ganho com cliques manuais no período. */
  clickEarned: Money;
  clicks: number;
}

export interface Notice {
  kind: 'success' | 'info' | 'warning' | 'error' | 'achievement';
  title: string;
  detail?: string;
}

export interface Settings {
  animations: boolean;
  sound: boolean;
  reduceMotion: boolean;
  compactNumbers: boolean;
}

export interface GameState {
  version: number;
  createdAt: number;
  /** Tempo simulado total do jogo (ms). Monotônico. */
  gameTime: number;
  /** Maior Date.now() já visto. Base do cálculo offline (protege contra relógio voltando). */
  lastRealTime: number;

  balance: Money;
  /** Fração de centavo ainda não creditada (renda passiva contínua). */
  carry: number;
  /** Dívida operacional: despesas que excederam o caixa. Abatida automaticamente. */
  debt: Money;

  stats: {
    clicks: number;
    clickEarned: Money;
    totalEarned: Money;
    totalSpent: Money;
    peakNetWorth: Money;
    lifetimeEarned: Money;
    profitableTrades: number;
    crisesSurvived: number;
  };

  upgrades: Record<string, number>;
  boost: { activeUntil: number; cooldownUntil: number };

  businesses: Record<string, BusinessState>;

  market: {
    assets: Record<string, AssetState>;
    stepCount: number;
    nextStepAt: number;
    regime: { kind: 'alta' | 'neutro' | 'baixa'; until: number };
    news: NewsItem[];
  };
  portfolio: Record<string, Holding>;
  realizedPnL: { stock: Money; crypto: Money };
  dividendsReceived: Money;

  realEstate: {
    holdings: Record<string, PropertyHolding>;
    regions: Record<string, RegionState>;
    developments: Development[];
    nextStepAt: number;
    realizedPnL: Money;
  };

  events: {
    active: ActiveEvent[];
    upcoming: ActiveEvent | null;
    nextAt: number;
    history: string[];
  };

  missions: { claimed: string[] };
  achievements: string[];

  ledger: LedgerEntry[];
  flow: { current: FlowPeriod; history: FlowPeriod[] };

  prestige: { points: number; resets: number };

  rng: RngState;
  /** Últimos IDs de ação processados (evita processar a mesma ação duas vezes). */
  processedActionIds: string[];
  nextId: number;

  settings: Settings;
  tutorialDone: boolean;

  /** Notificações transitórias (não são salvas). */
  notices: Notice[];
}

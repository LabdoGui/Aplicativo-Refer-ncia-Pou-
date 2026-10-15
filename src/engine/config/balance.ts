/**
 * Botões de balanceamento centralizados.
 * Ajuste aqui ganhos, custos, volatilidade e progressão sem tocar na lógica.
 * Use `npm run sim` para ver o efeito na curva de progressão.
 */
export const BALANCE = {
  /** Saldo inicial em centavos. */
  startingCash: 1_000, // R$ 10,00
  /** Valor base do clique em centavos. */
  baseClick: 100, // R$ 1,00

  /** Multiplicador global de toda a renda (debug/balanceamento). */
  incomeMultiplier: 1,
  /** Multiplicador global de custos de compra (melhorias e negócios). */
  costMultiplier: 1,

  /** Turbo de clique ("Hora do Rush"): multiplicador, duração e recarga (ms). */
  boost: { multiplier: 3, durationMs: 30_000, cooldownMs: 300_000 },

  /** Eficiência de um negócio sem gerente (fração da receita). */
  noManagerEfficiency: 0.6,
  /** Salário do gerente = baseRevenue * fator (centavos/s). */
  managerSalaryFactor: 3,
  /** Bônus multiplicativo de receita em marcos de nível do negócio. */
  levelMilestones: [25, 50, 100, 200, 300, 400, 500],
  /** Venda de negócio devolve esta fração do total investido. */
  businessResaleRatio: 0.5,

  market: {
    /** Intervalo entre atualizações de preço (ms de jogo). */
    stepMs: 10_000,
    /** Pontos de histórico guardados por ativo. */
    historyLength: 180,
    /** Resultados trimestrais a cada N passos. */
    earningsEverySteps: 30,
    /** Dividendos a cada N passos. */
    dividendEverySteps: 30,
    stockFeeRate: 0.0025,
    cryptoFeeRate: 0.005,
    volatilityMultiplier: 1,
  },

  realEstate: {
    stepMs: 60_000,
    purchaseFeeRate: 0.02,
    saleFeeRate: 0.04,
    maxRenovation: 3,
    renovationValueBonus: 0.15,
    renovationRentBonus: 0.2,
  },

  events: {
    /** Intervalo entre eventos (ms de jogo). */
    minGapMs: 240_000,
    maxGapMs: 480_000,
    /** Aviso prévio antes do evento começar (permite preparação). */
    warningMs: 60_000,
  },

  offline: {
    /** Limite de tempo offline creditado. */
    capMs: 8 * 3_600_000,
    /** Fração da renda creditada offline (1 = mesmas regras do jogo ativo). */
    efficiency: 1,
  },

  prestige: {
    /** Patrimônio mínimo (centavos) para reiniciar com bônus. */
    minNetWorth: 1_000_000_000, // R$ 10 milhões
    /** Unidade de patrimônio por ponto: pontos = floor(sqrt(pico / unidade)). */
    unit: 1_000_000_000,
    bonusPerPoint: 0.05,
  },

  /** Bônus permanente de renda por conquista desbloqueada. */
  achievementBonus: 0.01,

  /** Tamanho máximo do histórico financeiro guardado. */
  ledgerLimit: 400,
  /** Período de agregação do fluxo de caixa passivo (ms de jogo). */
  flowPeriodMs: 60_000,
  flowHistoryLength: 60,
} as const;

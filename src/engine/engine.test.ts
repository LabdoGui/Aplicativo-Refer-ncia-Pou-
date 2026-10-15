import { describe, expect, it } from 'vitest';
import { dispatch } from './actions';
import { BALANCE } from './config/balance';
import { BUSINESSES } from './config/businesses';
import {
  businessFinancials,
  businessLevelCost,
  clickValue,
  incomeBreakdown,
  netWorth,
  upgradeCost,
} from './economy';
import { averagePrice, quoteBuy, quoteSell, unrealizedPnL } from './market';
import { formatMoney, geometricCost, maxAffordable, mulRate, reais, toCents } from './money';
import { advance, applyOffline } from './simulation';
import { createInitialState } from './state';
import type { GameState } from './types';

const T0 = 1_700_000_000_000;
function fresh(balanceReais?: number): GameState {
  const s = createInitialState(T0, 12345);
  if (balanceReais !== undefined) s.balance = reais(balanceReais);
  return s;
}
function ledgerSum(s: GameState, sinceId = 0): bigint {
  return s.ledger.filter((e) => e.id > sinceId && e.category !== 'clique' && e.category !== 'renda' && e.category !== 'despesa' && e.category !== 'offline').reduce((a, e) => a + e.amount, 0n);
}

describe('dinheiro', () => {
  it('converte e formata sem erro de ponto flutuante', () => {
    expect(reais(0.1) + reais(0.2)).toBe(30n);
    expect(formatMoney(123456n)).toBe('R$ 1.234,56');
    expect(formatMoney(reais(1_500_000))).toBe('R$ 1,50 mi');
    expect(formatMoney(reais(2_340_000_000_000))).toBe('R$ 2,34 tri');
    expect(formatMoney(-500n)).toBe('-R$ 5,00');
  });

  it('formata valores astronômicos sem quebrar', () => {
    const huge = 10n ** 60n;
    expect(formatMoney(huge)).toMatch(/e\d+$/);
    expect(formatMoney(10n ** 20n)).toBe('R$ 1,00 qi');
  });

  it('mulRate tem precisão de 6 casas e arredonda para baixo', () => {
    expect(mulRate(10_000n, 0.0025)).toBe(25n);
    expect(mulRate(999n, 0.5)).toBe(499n);
  });

  it('custo geométrico e máximo comprável são consistentes', () => {
    const total = geometricCost(1000, 1.15, 0, 10);
    expect(maxAffordable(1000, 1.15, 0, total)).toBe(10);
    expect(maxAffordable(1000, 1.15, 0, total - 1n)).toBe(9);
    expect(() => toCents(Infinity)).toThrow();
  });
});

describe('cliques e melhorias', () => {
  it('clique credita o valor exibido', () => {
    const s = fresh();
    const before = s.balance;
    const v = toCents(clickValue(s), 'floor');
    dispatch(s, { type: 'click' });
    expect(s.balance - before).toBe(v);
    expect(s.stats.clicks).toBe(1);
  });

  it('compra de melhoria desconta exatamente o custo e registra no histórico', () => {
    const s = fresh(100);
    const cost = upgradeCost(s, 'clique');
    const res = dispatch(s, { type: 'buyUpgrade', id: 'clique' });
    expect(res.ok).toBe(true);
    expect(s.balance).toBe(reais(100) - cost);
    expect(s.upgrades.clique).toBe(1);
    expect(s.ledger.at(-1)?.amount).toBe(-cost);
  });

  it('saldo insuficiente não altera nada', () => {
    const s = fresh(0);
    const snapshot = JSON.stringify(s, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    const res = dispatch(s, { type: 'buyUpgrade', id: 'robo' });
    expect(res.ok).toBe(false);
    expect(JSON.stringify(s, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).toBe(snapshot);
  });

  it('comprar "máx" nunca deixa saldo negativo', () => {
    const s = fresh(10_000);
    dispatch(s, { type: 'buyUpgrade', id: 'robo', qty: 'max' });
    expect(s.balance >= 0n).toBe(true);
    expect(s.upgrades.robo).toBeGreaterThan(10);
    expect(dispatch(s, { type: 'buyUpgrade', id: 'robo' }).ok).toBe(s.balance >= upgradeCost(s, 'robo'));
  });

  it('o mesmo actionId não é processado duas vezes', () => {
    const s = fresh(1_000);
    expect(dispatch(s, { type: 'buyUpgrade', id: 'robo' }, 'abc').ok).toBe(true);
    const bal = s.balance;
    const r = dispatch(s, { type: 'buyUpgrade', id: 'robo' }, 'abc');
    expect(r.ok).toBe(false);
    expect(s.balance).toBe(bal);
    expect(s.upgrades.robo).toBe(1);
  });
});

describe('negócios', () => {
  it('compra, contrata gerente e calcula lucro coerente', () => {
    const s = fresh(10_000);
    expect(dispatch(s, { type: 'buyBusiness', id: 'loja' }).ok).toBe(true);
    const sem = businessFinancials(s, 'loja');
    expect(sem.revenue).toBeCloseTo(BUSINESSES[0].baseRevenue * BALANCE.noManagerEfficiency);
    expect(sem.profit).toBeCloseTo(sem.revenue - sem.expenses);
    expect(dispatch(s, { type: 'hireManager', id: 'loja' }).ok).toBe(true);
    const com = businessFinancials(s, 'loja');
    expect(com.revenue).toBeCloseTo(BUSINESSES[0].baseRevenue);
    expect(com.salary).toBeGreaterThan(0);
  });

  it('negócio bloqueado por patrimônio não pode ser comprado', () => {
    const s = fresh(10);
    const r = dispatch(s, { type: 'buyBusiness', id: 'banco' });
    expect(r.ok).toBe(false);
  });

  it('renda passiva é creditada pelo tempo transcorrido', () => {
    const s = fresh(1_000);
    dispatch(s, { type: 'buyBusiness', id: 'loja', qty: 5 });
    const rate = incomeBreakdown(s).net;
    const before = s.balance;
    advance(s, 10_000);
    const gained = Number(s.balance - before);
    expect(Math.abs(gained - rate * 10)).toBeLessThanOrEqual(1);
  });

  it('cada negócio tem perfil distinto (custo/receita/despesa)', () => {
    const profiles = new Set(BUSINESSES.map((b) => `${b.expenseRatio}-${b.growth}-${b.risk}`));
    expect(profiles.size).toBeGreaterThan(6);
  });

  it('venda de negócio devolve a fração anunciada', () => {
    const s = fresh(1_000);
    const cost = businessLevelCost(s, 'loja', 3);
    dispatch(s, { type: 'buyBusiness', id: 'loja', qty: 3 });
    const before = s.balance;
    dispatch(s, { type: 'sellBusiness', id: 'loja' });
    expect(s.balance - before).toBe(cost / 2n);
    expect(s.businesses.loja).toBeUndefined();
  });
});

describe('bolsa', () => {
  it('compra e venda com taxas, preço médio e P&L corretos', () => {
    const s = fresh(10_000);
    const q = quoteBuy(s, 'vrd', 10);
    expect(dispatch(s, { type: 'buyAsset', id: 'vrd', qty: 10 }).ok).toBe(true);
    expect(s.balance).toBe(reais(10_000) - q.total);
    expect(s.portfolio.vrd.costBasis).toBe(q.total);
    expect(averagePrice(s, 'vrd')).toBe(q.total / 10n);

    s.market.assets.vrd.price = s.market.assets.vrd.price * 2n; // preço dobra
    const sq = quoteSell(s, 'vrd', 10);
    const unreal = unrealizedPnL(s, 'vrd');
    const before = s.balance;
    expect(dispatch(s, { type: 'sellAsset', id: 'vrd', qty: 10 }).ok).toBe(true);
    expect(s.balance - before).toBe(sq.total);
    expect(s.realizedPnL.stock).toBe(sq.total - q.total);
    expect(unreal).toBe(sq.gross - q.total);
    expect(s.portfolio.vrd).toBeUndefined();
    expect(s.stats.profitableTrades).toBe(1);
  });

  it('venda parcial preserva o custo restante sem perder centavos', () => {
    const s = fresh(10_000);
    dispatch(s, { type: 'buyAsset', id: 'mrc', qty: 7 });
    const basis = s.portfolio.mrc.costBasis;
    dispatch(s, { type: 'sellAsset', id: 'mrc', qty: 3 });
    dispatch(s, { type: 'sellAsset', id: 'mrc', qty: 4 });
    const realized = s.realizedPnL.stock;
    // Soma dos resultados = recebido líquido total - custo total
    const received = s.ledger.filter((e) => e.description.startsWith('Venda')).reduce((a, e) => a + e.amount, 0n)
      - s.ledger.filter((e) => e.category === 'taxa').slice(1).reduce((a, e) => a - e.amount, 0n);
    expect(realized).toBe(received - basis);
  });

  it('não vende mais do que possui e rejeita quantidades inválidas', () => {
    const s = fresh(10_000);
    dispatch(s, { type: 'buyAsset', id: 'vrd', qty: 2 });
    expect(dispatch(s, { type: 'sellAsset', id: 'vrd', qty: 3 }).ok).toBe(false);
    expect(dispatch(s, { type: 'buyAsset', id: 'vrd', qty: 1.5 }).ok).toBe(false);
    expect(dispatch(s, { type: 'buyAsset', id: 'vrd', qty: -1 }).ok).toBe(false);
    expect(s.portfolio.vrd.qty).toBe(2);
  });

  it('preços evoluem, ficam positivos e o histórico tem tamanho limitado', () => {
    const s = fresh(10);
    advance(s, BALANCE.market.stepMs * 500);
    for (const a of Object.values(s.market.assets)) {
      expect(a.price > 0n).toBe(true);
      expect(a.history.length).toBeLessThanOrEqual(BALANCE.market.historyLength);
      expect(a.history.at(-1)).toBe(Number(a.price));
    }
  });

  it('mesma semente gera o mesmo mercado (determinístico)', () => {
    const a = fresh();
    const b = fresh();
    advance(a, 600_000);
    advance(b, 600_000);
    expect(a.market.assets.nbt.price).toBe(b.market.assets.nbt.price);
  });

  it('dividendos são pagos e registrados', () => {
    const s = fresh(100_000);
    dispatch(s, { type: 'buyAsset', id: 'vrd', qty: 100 });
    advance(s, BALANCE.market.stepMs * BALANCE.market.dividendEverySteps);
    expect(s.dividendsReceived > 0n).toBe(true);
    expect(s.ledger.some((e) => e.category === 'dividendo')).toBe(true);
  });
});

describe('imóveis', () => {
  it('compra, aluguel e venda com taxas explícitas', () => {
    const s = fresh(1_000_000);
    expect(dispatch(s, { type: 'buyProperty', id: 'casa' }).ok).toBe(true);
    expect(s.realEstate.holdings.casa.units).toBe(1);
    const rent = incomeBreakdown(s).sources['Aluguel: Casa'];
    expect(rent).toBeGreaterThan(0);
    const before = s.balance;
    expect(dispatch(s, { type: 'sellProperty', id: 'casa' }).ok).toBe(true);
    expect(s.balance < before + reais(20_000)).toBe(true); // taxa de venda aplicada
    expect(s.realEstate.holdings.casa).toBeUndefined();
  });

  it('desenvolvimento de terreno vira prédio após o prazo', () => {
    const s = fresh(100_000_000);
    s.stats.peakNetWorth = reais(100_000_000);
    expect(dispatch(s, { type: 'buyProperty', id: 'terreno' }).ok).toBe(true);
    expect(dispatch(s, { type: 'developProperty', id: 'terreno' }).ok).toBe(true);
    expect(s.realEstate.holdings.terreno).toBeUndefined();
    advance(s, 301_000);
    expect(s.realEstate.holdings.predio.units).toBe(1);
  });
});

describe('patrimônio e histórico', () => {
  it('patrimônio = caixa + ativos + imóveis + negócios - dívida', () => {
    const s = fresh(100_000);
    dispatch(s, { type: 'buyAsset', id: 'vrd', qty: 10 });
    dispatch(s, { type: 'buyBusiness', id: 'loja' });
    const nw = netWorth(s);
    expect(nw.total).toBe(nw.cash + nw.stocks + nw.crypto + nw.realEstate + nw.businesses - nw.debt);
  });

  it('toda variação de saldo por ação aparece no histórico', () => {
    const s = fresh(100_000);
    const start = s.balance;
    dispatch(s, { type: 'buyUpgrade', id: 'robo', qty: 3 });
    dispatch(s, { type: 'buyBusiness', id: 'loja', qty: 2 });
    dispatch(s, { type: 'buyAsset', id: 'vrd', qty: 5 });
    dispatch(s, { type: 'sellAsset', id: 'vrd', qty: 5 });
    expect(start + ledgerSum(s)).toBe(s.balance);
  });

  it('operações de grande valor permanecem exatas', () => {
    const s = fresh();
    s.balance = 10n ** 25n; // 100 sextilhões de reais... em centavos
    s.stats.peakNetWorth = s.balance;
    const r = dispatch(s, { type: 'buyBusiness', id: 'holding' });
    expect(r.ok).toBe(false); // exige escritório
    dispatch(s, { type: 'buyProperty', id: 'escritorio' });
    expect(dispatch(s, { type: 'buyBusiness', id: 'holding', qty: 50 }).ok).toBe(true);
    expect(s.balance > 0n).toBe(true);
    expect(start(s)).toBe(10n ** 25n);
    function start(st: GameState) {
      return st.balance - ledgerSum(st);
    }
  });

  it('despesas maiores que o caixa viram dívida explícita, nunca saldo negativo', () => {
    const s = fresh(0);
    s.realEstate.holdings.terreno = { units: 1, renovation: 0, costBasis: 0n }; // só manutenção
    advance(s, 60_000);
    expect(s.balance).toBe(0n);
    expect(s.debt > 0n).toBe(true);
    dispatch(s, { type: 'click', count: 20 });
    expect(s.balance >= 0n).toBe(true);
  });
});

describe('offline', () => {
  it('credita o mesmo que o jogo ativo pelo mesmo tempo', () => {
    const a = fresh(10_000);
    dispatch(a, { type: 'buyBusiness', id: 'loja', qty: 10 });
    dispatch(a, { type: 'hireManager', id: 'loja' });
    const b = structuredClone(a);
    advance(a, 600_000);
    b.lastRealTime = T0;
    applyOffline(b, T0 + 600_000);
    expect(b.balance).toBe(a.balance);
  });

  it('respeita o limite de tempo offline', () => {
    const s = fresh(10_000);
    dispatch(s, { type: 'buyUpgrade', id: 'robo', qty: 10 });
    const r = applyOffline(s, T0 + 100 * 3_600_000, 3_600_000)!;
    expect(r.capped).toBe(true);
    expect(r.creditedMs).toBe(3_600_000);
  });

  it('aplicar duas vezes não credita em dobro', () => {
    const s = fresh(10_000);
    dispatch(s, { type: 'buyUpgrade', id: 'robo', qty: 10 });
    applyOffline(s, T0 + 3_600_000);
    const bal = s.balance;
    expect(applyOffline(s, T0 + 3_600_000)).toBeNull();
    expect(s.balance).toBe(bal);
  });

  it('voltar o relógio não gera dinheiro e não permite repetir o crédito', () => {
    const s = fresh(10_000);
    dispatch(s, { type: 'buyUpgrade', id: 'robo', qty: 10 });
    applyOffline(s, T0 + 3_600_000); // ganhou 1h legítima
    const bal = s.balance;
    const r = applyOffline(s, T0 + 1_000)!; // relógio voltou
    expect(r.clockWentBack).toBe(true);
    expect(s.balance).toBe(bal);
    applyOffline(s, T0 + 3_600_000); // volta ao horário já creditado
    expect(s.balance).toBe(bal);
  });

  it('não apaga investimentos e gera relatório coerente', () => {
    const s = fresh(10_000);
    dispatch(s, { type: 'buyAsset', id: 'vrd', qty: 50 });
    dispatch(s, { type: 'buyBusiness', id: 'loja', qty: 3 });
    const r = applyOffline(s, T0 + 2 * 3_600_000)!;
    expect(s.portfolio.vrd.qty).toBe(50);
    expect(s.businesses.loja.level).toBe(3);
    expect(r.net).toBe(s.ledger.find((e) => e.category === 'offline')!.amount);
  });
});

describe('missões e prestígio', () => {
  it('missão só paga uma vez e só quando concluída', () => {
    const s = fresh(0);
    expect(dispatch(s, { type: 'claimMission', id: 't1' }).ok).toBe(false);
    for (let i = 0; i < 10; i++) dispatch(s, { type: 'click' });
    expect(dispatch(s, { type: 'claimMission', id: 't1' }).ok).toBe(true);
    expect(dispatch(s, { type: 'claimMission', id: 't1' }).ok).toBe(false);
  });

  it('Legado reinicia a partida mantendo bônus e conquistas', () => {
    const s = fresh(0);
    s.balance = reais(50_000_000);
    s.stats.lifetimeEarned = reais(50_000_000);
    advance(s, 1000);
    const ach = s.achievements.length;
    expect(dispatch(s, { type: 'prestige' }).ok).toBe(true);
    expect(s.prestige.points).toBe(2);
    expect(s.balance).toBe(BigInt(BALANCE.startingCash));
    expect(s.achievements.length).toBe(ach + 1); // + conquista "Dinastia"
    expect(s.achievements).toContain('a_prestige');
    expect(dispatch(s, { type: 'prestige' }).ok).toBe(false);
  });
});

describe('novo jogo e Legado', () => {
  it('nova partida já tem histórico de mercado gerado pelo próprio modelo', async () => {
    const { newGame, PRE_HISTORY_STEPS } = await import('./simulation');
    const s = newGame(T0, 7);
    expect(s.market.assets.vrd.history.length).toBe(PRE_HISTORY_STEPS + 1);
    expect(s.balance).toBe(BigInt(BALANCE.startingCash));
    expect(s.ledger.length).toBe(0);
  });

  it('Legado mantém o mercado e o relógio funcionando', () => {
    const s = fresh(0);
    advance(s, 120_000);
    s.balance = reais(50_000_000);
    s.stats.lifetimeEarned = reais(50_000_000);
    advance(s, 1000);
    const t = s.gameTime;
    const price = s.market.assets.nbt.price;
    dispatch(s, { type: 'prestige' });
    expect(s.gameTime).toBe(t);
    expect(s.market.assets.nbt.price).toBe(price);
    const steps = s.market.stepCount;
    advance(s, BALANCE.market.stepMs * 3);
    expect(s.market.stepCount).toBe(steps + 3);
  });
});

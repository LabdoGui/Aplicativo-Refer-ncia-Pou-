/**
 * Mercado financeiro fictício (ações e criptomoedas).
 *
 * Modelo de preço por passo (log-retorno):
 *   r = tendência do ativo + clima do mercado + efeito de eventos do setor
 *     + momento (autocorrelação de curto prazo)
 *     - reversão à média em direção ao valor fundamental
 *     + choque aleatório * volatilidade
 * A cada período de resultados, ações divulgam lucro acima/abaixo do esperado:
 * o preço salta e o valor fundamental muda — sempre com notícia explicando o motivo.
 */
import { ASSETS, ASSET_BY_ID, type AssetDef } from './config/assets';
import { BALANCE } from './config/balance';
import { netWorth, type EventModifiers } from './economy';
import { applyTransaction, notify } from './ledger';
import { formatMoney, formatPercent, mulRateCeil, toCents, type Money } from './money';
import { nextGaussian, nextRandom } from './rng';
import type { GameState, NewsItem } from './types';

const REGIME_DRIFT = { alta: 0.0006, neutro: 0, baixa: -0.0006 } as const;
const REGIME_LABEL = { alta: 'Mercado em alta', neutro: 'Mercado estável', baixa: 'Mercado em baixa' } as const;

export function regimeLabel(kind: keyof typeof REGIME_LABEL): string {
  return REGIME_LABEL[kind];
}

function pushNews(s: GameState, item: Omit<NewsItem, 'id' | 'at'>): void {
  s.market.news.unshift({ ...item, id: s.nextId++, at: s.gameTime });
  if (s.market.news.length > 40) s.market.news.length = 40;
}

function stepRegime(s: GameState): void {
  if (s.gameTime < s.market.regime.until) return;
  const r = nextRandom(s.rng);
  const prev = s.market.regime.kind;
  const kind = r < 0.35 ? 'alta' : r < 0.75 ? 'neutro' : 'baixa';
  const duration = 300_000 + nextRandom(s.rng) * 600_000;
  s.market.regime = { kind, until: s.gameTime + duration };
  if (kind !== prev) {
    pushNews(s, {
      title: REGIME_LABEL[kind],
      detail:
        kind === 'alta'
          ? 'Otimismo dos investidores: a maioria dos ativos tende a subir nos próximos minutos.'
          : kind === 'baixa'
            ? 'Aversão a risco: a maioria dos ativos tende a cair. Ativos defensivos sofrem menos.'
            : 'Sem grande direção: os preços seguem os fundamentos de cada empresa.',
      tone: kind === 'alta' ? 'good' : kind === 'baixa' ? 'bad' : 'neutral',
    });
  }
}

function stepAsset(s: GameState, def: AssetDef, mods: EventModifiers, earnings: boolean): void {
  const st = s.market.assets[def.id];
  if (!st) return;
  const vol = def.volatility * BALANCE.market.volatilityMultiplier;
  const price = Number(st.price);
  // Fundamento cresce com a tendência de longo prazo do ativo.
  st.fundamental *= Math.exp(def.drift);
  const regime = REGIME_DRIFT[s.market.regime.kind] * (def.risk === 'baixo' ? 0.5 : def.kind === 'crypto' ? 2 : 1);
  const eventDrift = mods.assetDrift[def.sector] ?? 0;
  const reversion = -def.meanReversion * Math.log(price / st.fundamental);
  const shock = nextGaussian(s.rng) * vol;
  st.momentum = 0.85 * st.momentum + 0.15 * shock * 0.5;
  let r = def.drift + regime + eventDrift + reversion + st.momentum + shock;

  if (earnings && def.kind === 'stock') {
    const surprise = Math.max(-3, Math.min(3, nextGaussian(s.rng)));
    const jump = surprise * vol * 2.5;
    r += jump;
    st.fundamental *= Math.exp(surprise * 0.02);
    if (Math.abs(surprise) > 0.6) {
      const good = surprise > 0;
      pushNews(s, {
        title: `${def.name} ${good ? 'supera' : 'decepciona'} nas projeções de lucro`,
        detail: `Resultado trimestral ${good ? 'acima' : 'abaixo'} do esperado. Impacto imediato estimado: ${formatPercent(Math.exp(jump) - 1, 1, true)}.`,
        tone: good ? 'good' : 'bad',
        assetId: def.id,
      });
    }
  }
  if (def.kind === 'crypto' && nextRandom(s.rng) < 0.004) {
    const good = nextRandom(s.rng) < 0.5;
    const jump = (good ? 1 : -1) * vol * 4;
    r += jump;
    st.fundamental *= Math.exp(jump * 0.5);
    pushNews(s, {
      title: good ? `${def.name} anuncia parceria de adoção` : `Falha técnica atinge a rede ${def.name}`,
      detail: `Movimento imediato estimado: ${formatPercent(Math.exp(jump) - 1, 1, true)}.`,
      tone: good ? 'good' : 'bad',
      assetId: def.id,
    });
  }
  r = Math.max(-0.5, Math.min(0.5, r));
  const next = Math.max(1, price * Math.exp(r));
  st.price = toCents(next);
  st.history.push(Number(st.price));
  if (st.history.length > BALANCE.market.historyLength) {
    st.history.splice(0, st.history.length - BALANCE.market.historyLength);
  }
  st.openPrice = st.history[0];
}

function payDividends(s: GameState): void {
  for (const [id, h] of Object.entries(s.portfolio)) {
    const def = ASSET_BY_ID[id];
    if (!def || def.dividendYield <= 0 || h.qty <= 0) continue;
    const price = s.market.assets[id].price;
    const amount = toCents(Number(price) * h.qty * def.dividendYield, 'floor');
    if (amount <= 0n) continue;
    applyTransaction(s, amount, 'dividendo', `Dividendos ${def.ticker}: ${h.qty} × ${formatPercent(def.dividendYield, 2)}`);
    s.dividendsReceived += amount;
  }
}

/** Executa um passo de mercado (chamado pelo simulador a cada BALANCE.market.stepMs). */
export function stepMarket(s: GameState, mods: EventModifiers): void {
  stepRegime(s);
  s.market.stepCount++;
  const earnings = s.market.stepCount % BALANCE.market.earningsEverySteps === 0;
  for (const def of ASSETS) stepAsset(s, def, mods, earnings);
  if (s.market.stepCount % BALANCE.market.dividendEverySteps === 0) payDividends(s);
}

// ---------------------------------------------------------------- negociação

export function feeRate(def: AssetDef): number {
  return def.kind === 'crypto' ? BALANCE.market.cryptoFeeRate : BALANCE.market.stockFeeRate;
}

export interface TradeQuote {
  gross: Money;
  fee: Money;
  total: Money; // compra: gross + fee | venda: gross - fee
}

export function quoteBuy(s: GameState, assetId: string, qty: number): TradeQuote {
  const def = ASSET_BY_ID[assetId];
  const gross = s.market.assets[assetId].price * BigInt(qty);
  const fee = mulRateCeil(gross, feeRate(def));
  return { gross, fee, total: gross + fee };
}

export function quoteSell(s: GameState, assetId: string, qty: number): TradeQuote {
  const def = ASSET_BY_ID[assetId];
  const gross = s.market.assets[assetId].price * BigInt(qty);
  const fee = mulRateCeil(gross, feeRate(def));
  return { gross, fee, total: gross - fee };
}

/** Quantidade máxima comprável com o saldo atual (incluindo taxa). */
export function maxBuyQty(s: GameState, assetId: string): number {
  const def = ASSET_BY_ID[assetId];
  const price = s.market.assets[assetId].price;
  if (price <= 0n) return 0;
  let q = Number((s.balance * 1_000_000n) / (price * BigInt(Math.round((1 + feeRate(def)) * 1_000_000))));
  q = Math.min(q, 1_000_000_000);
  while (q > 0 && quoteBuy(s, assetId, q).total > s.balance) q--;
  return Math.max(0, q);
}

export type TradeResult = { ok: true } | { ok: false; error: string };

export function buyAsset(s: GameState, assetId: string, qty: number): TradeResult {
  const def = ASSET_BY_ID[assetId];
  if (!def) return { ok: false, error: 'Ativo inexistente.' };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'Quantidade inválida.' };
  if (!s.portfolio[assetId] && netWorth(s).total < BigInt(def.unlockNetWorth)) return { ok: false, error: 'Ativo ainda bloqueado.' };
  const q = quoteBuy(s, assetId, qty);
  if (q.total > s.balance) return { ok: false, error: `Saldo insuficiente: precisa de ${formatMoney(q.total)}.` };
  const h = (s.portfolio[assetId] ??= { qty: 0, costBasis: 0n });
  h.qty += qty;
  h.costBasis += q.total;
  applyTransaction(s, -q.gross, def.kind === 'crypto' ? 'cripto' : 'acao', `Compra ${qty} ${def.ticker} @ ${formatMoney(s.market.assets[assetId].price)}`);
  if (q.fee > 0n) applyTransaction(s, -q.fee, 'taxa', `Taxa de corretagem ${def.ticker} (${formatPercent(feeRate(def), 2)})`, { isSpending: true });
  return { ok: true };
}

export function sellAsset(s: GameState, assetId: string, qty: number): TradeResult {
  const def = ASSET_BY_ID[assetId];
  const h = s.portfolio[assetId];
  if (!def) return { ok: false, error: 'Ativo inexistente.' };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'Quantidade inválida.' };
  if (!h || h.qty < qty) return { ok: false, error: 'Você não possui essa quantidade.' };
  const q = quoteSell(s, assetId, qty);
  // Custo proporcional; a última unidade leva o resto (sem perda de centavos por arredondamento).
  const basis = qty === h.qty ? h.costBasis : (h.costBasis * BigInt(qty)) / BigInt(h.qty);
  const pnl = q.total - basis;
  h.qty -= qty;
  h.costBasis -= basis;
  if (h.qty === 0) delete s.portfolio[assetId];
  const cat = def.kind === 'crypto' ? 'cripto' : 'acao';
  applyTransaction(s, q.gross, cat, `Venda ${qty} ${def.ticker} @ ${formatMoney(s.market.assets[assetId].price)} (resultado ${formatMoney(pnl, { sign: true })})`);
  if (q.fee > 0n) applyTransaction(s, -q.fee, 'taxa', `Taxa de corretagem ${def.ticker} (${formatPercent(feeRate(def), 2)})`, { isSpending: true });
  if (def.kind === 'crypto') s.realizedPnL.crypto += pnl;
  else s.realizedPnL.stock += pnl;
  if (pnl > 0n) {
    s.stats.profitableTrades++;
  }
  notify(s, {
    kind: pnl >= 0n ? 'success' : 'warning',
    title: `Venda de ${def.ticker}`,
    detail: `Resultado realizado: ${formatMoney(pnl, { sign: true })}`,
  });
  return { ok: true };
}

export function unrealizedPnL(s: GameState, assetId: string): Money {
  const h = s.portfolio[assetId];
  if (!h) return 0n;
  return s.market.assets[assetId].price * BigInt(h.qty) - h.costBasis;
}

export function averagePrice(s: GameState, assetId: string): Money {
  const h = s.portfolio[assetId];
  if (!h || h.qty === 0) return 0n;
  return h.costBasis / BigInt(h.qty);
}

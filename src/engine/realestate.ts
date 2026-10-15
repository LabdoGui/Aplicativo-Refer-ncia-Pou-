/**
 * Mercado imobiliário: regiões com ciclos previsíveis (senoide + tendência + ruído pequeno),
 * compra/venda com taxas explícitas, reformas e desenvolvimento de terrenos.
 */
import { BALANCE } from './config/balance';
import { PROPERTY_BY_ID, REGIONS } from './config/realestate';
import {
  netWorth,
  propertyBuyCost,
  propertySaleValue,
  renovationCost,
  type EventModifiers,
} from './economy';
import { applyTransaction, notify } from './ledger';
import { formatMoney, toCents } from './money';
import { nextGaussian } from './rng';
import type { GameState } from './types';

export function stepRealEstate(s: GameState, mods: EventModifiers): void {
  for (const def of REGIONS) {
    const st = s.realEstate.regions[def.id];
    if (!st) continue;
    st.phase = (st.phase + (2 * Math.PI) / def.cyclePeriod) % (2 * Math.PI);
    const cycle = def.cycleAmplitude * Math.sin(st.phase);
    const ev = (mods.regionDrift[def.id] ?? 0) + (mods.regionDrift['*'] ?? 0);
    // Reversão suave mantém o índice numa faixa razoável no longo prazo.
    const trendTarget = 1;
    const reversion = -0.01 * Math.log(st.index / trendTarget) * (st.index > 2.5 || st.index < 0.6 ? 3 : 1);
    const r = def.drift + cycle + ev + reversion + nextGaussian(s.rng) * def.noise;
    st.index = Math.max(0.3, Math.min(5, st.index * Math.exp(r)));
    st.history.push(Math.round(st.index * 10_000) / 10_000);
    if (st.history.length > 120) st.history.splice(0, st.history.length - 120);
  }
  completeDevelopments(s);
}

export function completeDevelopments(s: GameState): void {
  const done = s.realEstate.developments.filter((d) => d.readyAt <= s.gameTime);
  if (!done.length) return;
  s.realEstate.developments = s.realEstate.developments.filter((d) => d.readyAt > s.gameTime);
  for (const d of done) {
    const to = PROPERTY_BY_ID[d.toDefId];
    const h = (s.realEstate.holdings[d.toDefId] ??= { units: 0, renovation: 0, costBasis: 0n });
    h.units++;
    h.costBasis += d.costBasis;
    notify(s, { kind: 'success', title: `${to.icon} ${to.name} concluído!`, detail: 'O empreendimento já está gerando aluguel.' });
  }
}

export type REResult = { ok: true } | { ok: false; error: string };

export function buyProperty(s: GameState, id: string): REResult {
  const def = PROPERTY_BY_ID[id];
  if (!def) return { ok: false, error: 'Imóvel inexistente.' };
  if (netWorth(s).total < BigInt(def.unlockNetWorth) && !(s.realEstate.holdings[id]?.units))
    return { ok: false, error: 'Imóvel ainda bloqueado.' };
  const q = propertyBuyCost(s, id);
  if (q.total > s.balance) return { ok: false, error: `Saldo insuficiente: precisa de ${formatMoney(q.total)}.` };
  const h = (s.realEstate.holdings[id] ??= { units: 0, renovation: 0, costBasis: 0n });
  h.units++;
  h.costBasis += q.total;
  applyTransaction(s, -q.price, 'imovel', `Compra: ${def.name} (${h.units}ª unidade)`);
  applyTransaction(s, -q.fee, 'taxa', `Taxa de transferência ${def.name} (${BALANCE.realEstate.purchaseFeeRate * 100}%)`, { isSpending: true });
  return { ok: true };
}

export function sellProperty(s: GameState, id: string): REResult {
  const def = PROPERTY_BY_ID[id];
  const h = s.realEstate.holdings[id];
  if (!def || !h || h.units <= 0) return { ok: false, error: 'Você não possui este imóvel.' };
  const q = propertySaleValue(s, id);
  const basis = h.units === 1 ? h.costBasis : h.costBasis / BigInt(h.units);
  const pnl = q.net - basis;
  h.units--;
  h.costBasis -= basis;
  if (h.units === 0) delete s.realEstate.holdings[id];
  s.realEstate.realizedPnL += pnl;
  applyTransaction(s, q.price, 'imovel', `Venda: ${def.name} (resultado ${formatMoney(pnl, { sign: true })})`);
  applyTransaction(s, -q.fee, 'taxa', `Corretagem imobiliária ${def.name} (${BALANCE.realEstate.saleFeeRate * 100}%)`, { isSpending: true });
  return { ok: true };
}

export function renovateProperty(s: GameState, id: string): REResult {
  const def = PROPERTY_BY_ID[id];
  const h = s.realEstate.holdings[id];
  if (!def || !h || h.units <= 0) return { ok: false, error: 'Você não possui este imóvel.' };
  if (h.renovation >= BALANCE.realEstate.maxRenovation) return { ok: false, error: 'Reforma máxima atingida.' };
  const cost = renovationCost(s, id);
  if (cost > s.balance) return { ok: false, error: `Saldo insuficiente: precisa de ${formatMoney(cost)}.` };
  h.renovation++;
  h.costBasis += cost;
  applyTransaction(s, -cost, 'imovel', `Reforma nível ${h.renovation}: ${def.name} (${h.units} un.)`, { isSpending: true });
  return { ok: true };
}

export function developProperty(s: GameState, id: string): REResult {
  const def = PROPERTY_BY_ID[id];
  const h = s.realEstate.holdings[id];
  if (!def?.develop) return { ok: false, error: 'Este imóvel não pode ser desenvolvido.' };
  if (!h || h.units <= 0) return { ok: false, error: 'Você não possui este imóvel.' };
  const cost = toCents(def.develop.cost * BALANCE.costMultiplier, 'ceil');
  if (cost > s.balance) return { ok: false, error: `Saldo insuficiente: precisa de ${formatMoney(cost)}.` };
  const basis = h.units === 1 ? h.costBasis : h.costBasis / BigInt(h.units);
  h.units--;
  h.costBasis -= basis;
  if (h.units === 0) delete s.realEstate.holdings[id];
  s.realEstate.developments.push({
    id: s.nextId++,
    fromDefId: id,
    toDefId: def.develop.toId,
    readyAt: s.gameTime + def.develop.durationMs,
    costBasis: basis + cost,
  });
  applyTransaction(s, -cost, 'imovel', `Obra: ${def.name} → ${PROPERTY_BY_ID[def.develop.toId].name}`, { isSpending: true });
  return { ok: true };
}

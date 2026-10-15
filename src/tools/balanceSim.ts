/**
 * Simulador de balanceamento: um "jogador guloso" que clica algumas vezes por segundo
 * e sempre compra a opção com menor tempo de retorno. Imprime quando atinge cada marco.
 *
 * Uso: npm run sim -- [horas=6] [cliquesPorSegundo=3]
 * Ajuste config/balance.ts e rode de novo para comparar curvas.
 */
import { dispatch, type Action } from '../engine/actions';
import { BUSINESSES } from '../engine/config/businesses';
import { UPGRADES } from '../engine/config/upgrades';
import {
  businessFinancials,
  businessLevelCost,
  clickValue,
  incomeBreakdown,
  isBusinessUnlocked,
  managerHireCost,
  netWorth,
  upgradeCost,
} from '../engine/economy';
import { formatDuration, formatMoney, formatRate } from '../engine/money';
import { advance } from '../engine/simulation';
import { createInitialState } from '../engine/state';
import type { GameState } from '../engine/types';

declare const process: { argv: string[] };

const hours = Number(process.argv[2] ?? 6);
const cps = Number(process.argv[3] ?? 3);

function candidates(s: GameState): { action: Action; cost: bigint; gain: number; label: string }[] {
  const out: { action: Action; cost: bigint; gain: number; label: string }[] = [];
  const nw = netWorth(s).total;
  const base = incomeBreakdown(s).net + clickValue(s) * cps;
  const gainOf = (mutate: (c: GameState) => void) => {
    const c = structuredClone(s);
    mutate(c);
    return incomeBreakdown(c).net + clickValue(c) * cps - base;
  };
  for (const u of UPGRADES) {
    const lvl = s.upgrades[u.id] ?? 0;
    if (lvl >= u.maxLevel || nw < BigInt(u.unlockNetWorth)) continue;
    out.push({ action: { type: 'buyUpgrade', id: u.id }, cost: upgradeCost(s, u.id), gain: gainOf((c) => (c.upgrades[u.id] = lvl + 1)), label: u.name });
  }
  for (const b of BUSINESSES) {
    if (!isBusinessUnlocked(s, b, nw)) continue;
    const st = s.businesses[b.id];
    const cur = businessFinancials(s, b.id).profit;
    out.push({
      action: { type: 'buyBusiness', id: b.id },
      cost: businessLevelCost(s, b.id),
      gain: businessFinancials(s, b.id, { level: (st?.level ?? 0) + 1 }).profit - cur,
      label: `${b.name} ${(st?.level ?? 0) + 1}`,
    });
    if (st && !st.manager) {
      out.push({ action: { type: 'hireManager', id: b.id }, cost: managerHireCost(b), gain: businessFinancials(s, b.id, { manager: true }).profit - cur, label: `Gerente ${b.name}` });
    }
  }
  return out.filter((c) => c.gain > 0);
}

const s = createInitialState(0, 42);
const milestones = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12].map((r) => BigInt(r * 100));
let next = 0;
const firstBuy = new Map<string, number>();
const STEP = 1000;
const total = hours * 3_600_000;
const t0 = performance.now();
for (let t = 0; t < total; t += STEP) {
  dispatch(s, { type: 'click', count: cps });
  advance(s, STEP);
  // Compra enquanto houver algo que se pague em menos de 30 min.
  for (let i = 0; i < 20; i++) {
    const best = candidates(s).sort((a, b) => Number(a.cost) / a.gain - Number(b.cost) / b.gain)[0];
    if (!best || best.cost > s.balance || Number(best.cost) / best.gain > 1800) break;
    if (!dispatch(s, best.action).ok) break;
    if (!firstBuy.has(best.label.replace(/ \d+$/, ''))) firstBuy.set(best.label.replace(/ \d+$/, ''), s.gameTime);
  }
  const nw = netWorth(s).total;
  while (next < milestones.length && nw >= milestones[next]) {
    console.log(`${formatDuration(s.gameTime / 1000).padEnd(10)} patrimônio ${formatMoney(milestones[next]).padEnd(14)} renda ${formatRate(incomeBreakdown(s).net)}`);
    next++;
  }
}
console.log('\nPrimeira compra de cada item:');
for (const [k, v] of firstBuy) console.log(`  ${formatDuration(v / 1000).padEnd(10)} ${k}`);
console.log(`\nFinal (${hours}h): patrimônio ${formatMoney(netWorth(s).total)} | renda ${formatRate(incomeBreakdown(s).net)} | cliques ${s.stats.clicks}`);
console.log(`Simulado em ${((performance.now() - t0) / 1000).toFixed(1)}s`);

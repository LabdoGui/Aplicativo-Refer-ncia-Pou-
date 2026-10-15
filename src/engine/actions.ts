/**
 * Ações do jogador. Regras:
 * 1. Validar TUDO antes de alterar qualquer coisa (ação é atômica: ou acontece inteira ou não acontece).
 * 2. Toda mudança de saldo passa por applyTransaction (histórico auditável).
 * 3. Cada ação tem um ID; um ID já processado é ignorado (sem compra/venda duplicada em reenvios).
 */
import { BALANCE } from './config/balance';
import { BUSINESS_BY_ID, BUSINESS_RULES } from './config/businesses';
import { MISSIONS } from './config/missions';
import { UPGRADE_BY_ID } from './config/upgrades';
import {
  branchCost,
  businessLevelCost,
  businessRequirementMissing,
  clickValue,
  competitorCost,
  managerHireCost,
  marketingCost,
  netWorth,
  prestigePointsAvailable,
  upgradeCost,
} from './economy';
import { applyTransaction, notify, recordSummary } from './ledger';
import { buyAsset, sellAsset } from './market';
import { maxAffordable, toCents, formatMoney } from './money';
import { missionProgress, progressContext, updateProgress } from './progress';
import { buyProperty, developProperty, renovateProperty, sellProperty } from './realestate';
import { closeFlowPeriod } from './simulation';
import { createInitialState, emptyFlow } from './state';
import type { GameState, Settings } from './types';

export type Quantity = number | 'max';

export type Action =
  | { type: 'click'; count?: number }
  | { type: 'buyUpgrade'; id: string; qty?: Quantity }
  | { type: 'activateBoost' }
  | { type: 'buyBusiness'; id: string; qty?: Quantity }
  | { type: 'hireManager'; id: string }
  | { type: 'buyMarketing'; id: string }
  | { type: 'openBranch'; id: string }
  | { type: 'acquireCompetitor'; id: string }
  | { type: 'sellBusiness'; id: string }
  | { type: 'buyAsset'; id: string; qty: number }
  | { type: 'sellAsset'; id: string; qty: number }
  | { type: 'buyProperty'; id: string }
  | { type: 'sellProperty'; id: string }
  | { type: 'renovateProperty'; id: string }
  | { type: 'developProperty'; id: string }
  | { type: 'claimMission'; id: string }
  | { type: 'prestige' }
  | { type: 'updateSettings'; patch: Partial<Settings> };

export type ActionResult = { ok: true } | { ok: false; error: string; duplicate?: boolean };

const fail = (error: string): ActionResult => ({ ok: false, error });
const OK: ActionResult = { ok: true };

/** Converte quantidade pedida em número de níveis, limitado ao que cabe no saldo e no máximo. */
function resolveLevels(
  s: GameState,
  qty: Quantity | undefined,
  baseCost: number,
  growth: number,
  current: number,
  maxLevel: number,
): number {
  const room = Math.max(0, maxLevel - current);
  if (qty === 'max') return Math.min(room, maxAffordable(baseCost, growth, current, s.balance, room));
  const n = qty ?? 1;
  if (!Number.isInteger(n) || n <= 0) return 0;
  return Math.min(n, room);
}

function doClick(s: GameState, count: number): ActionResult {
  // Limite por ação: impede que um único evento (ou script) registre milhares de cliques.
  const n = Math.max(1, Math.min(20, Math.floor(count)));
  const value = toCents(clickValue(s) * n, 'floor');
  applyTransaction(s, value, 'clique', 'Clique', { silent: true });
  s.stats.clicks += n;
  s.stats.clickEarned += value;
  s.flow.current.clicks += n;
  s.flow.current.clickEarned += value;
  return OK;
}

function doBuyUpgrade(s: GameState, id: string, qty?: Quantity): ActionResult {
  const def = UPGRADE_BY_ID[id];
  if (!def) return fail('Melhoria inexistente.');
  if (netWorth(s).total < BigInt(def.unlockNetWorth) && !(s.upgrades[id] > 0)) return fail('Melhoria ainda bloqueada.');
  const level = s.upgrades[id] ?? 0;
  if (level >= def.maxLevel) return fail('Nível máximo atingido.');
  const n = resolveLevels(s, qty, def.baseCost * BALANCE.costMultiplier, def.growth, level, def.maxLevel);
  if (n <= 0) return fail('Saldo insuficiente.');
  const cost = upgradeCost(s, id, n);
  if (cost > s.balance) return fail(`Saldo insuficiente: precisa de ${formatMoney(cost)}.`);
  s.upgrades[id] = level + n;
  applyTransaction(s, -cost, 'melhoria', `${def.name} nível ${level + n}${n > 1 ? ` (+${n})` : ''}`, { isSpending: true });
  return OK;
}

function doBoost(s: GameState): ActionResult {
  if (s.gameTime < s.boost.cooldownUntil) return fail('Turbo ainda recarregando.');
  s.boost.activeUntil = s.gameTime + BALANCE.boost.durationMs;
  s.boost.cooldownUntil = s.gameTime + BALANCE.boost.cooldownMs;
  return OK;
}

function doBuyBusiness(s: GameState, id: string, qty?: Quantity): ActionResult {
  const def = BUSINESS_BY_ID[id];
  if (!def) return fail('Negócio inexistente.');
  const st = s.businesses[id];
  const level = st?.level ?? 0;
  if (level === 0) {
    if (netWorth(s).total < BigInt(def.unlockNetWorth)) return fail(`Exige patrimônio de ${formatMoney(BigInt(def.unlockNetWorth))}.`);
    const missing = businessRequirementMissing(s, def);
    if (missing) return fail(missing);
  }
  if (level >= def.maxLevel) return fail('Nível máximo atingido.');
  const n = resolveLevels(s, qty, def.baseCost * BALANCE.costMultiplier, def.growth, level, def.maxLevel);
  if (n <= 0) return fail('Saldo insuficiente.');
  const cost = businessLevelCost(s, id, n);
  if (cost > s.balance) return fail(`Saldo insuficiente: precisa de ${formatMoney(cost)}.`);
  const b = (s.businesses[id] ??= { level: 0, manager: false, marketing: 0, branches: 0, acquiredCompetitor: false, invested: 0n });
  b.level += n;
  b.invested += cost;
  applyTransaction(s, -cost, 'negocio', level === 0 ? `Aquisição: ${def.name}${n > 1 ? ` (nível ${b.level})` : ''}` : `${def.name}: nível ${b.level}${n > 1 ? ` (+${n})` : ''}`, { isSpending: true });
  if (level === 0) notify(s, { kind: 'success', title: `${def.icon} Novo negócio: ${def.name}`, detail: 'Contrate um gerente para operar a 100%.' });
  return OK;
}

function ownedBusiness(s: GameState, id: string) {
  const def = BUSINESS_BY_ID[id];
  const b = s.businesses[id];
  if (!def || !b || b.level <= 0) return null;
  return { def, b };
}

function doHireManager(s: GameState, id: string): ActionResult {
  const o = ownedBusiness(s, id);
  if (!o) return fail('Você não possui este negócio.');
  if (o.b.manager) return fail('Já existe um gerente.');
  const cost = managerHireCost(o.def);
  if (cost > s.balance) return fail(`Saldo insuficiente: precisa de ${formatMoney(cost)}.`);
  o.b.manager = true;
  o.b.invested += cost;
  applyTransaction(s, -cost, 'negocio', `Contratação de gerente: ${o.def.name}`, { isSpending: true });
  return OK;
}

function doMarketing(s: GameState, id: string): ActionResult {
  const o = ownedBusiness(s, id);
  if (!o) return fail('Você não possui este negócio.');
  if (o.b.marketing >= BUSINESS_RULES.maxMarketing) return fail('Marketing no máximo.');
  const cost = marketingCost(o.def, o.b.marketing);
  if (cost > s.balance) return fail(`Saldo insuficiente: precisa de ${formatMoney(cost)}.`);
  o.b.marketing++;
  o.b.invested += cost;
  applyTransaction(s, -cost, 'negocio', `Marketing nível ${o.b.marketing}: ${o.def.name}`, { isSpending: true });
  return OK;
}

function doBranch(s: GameState, id: string): ActionResult {
  const o = ownedBusiness(s, id);
  if (!o) return fail('Você não possui este negócio.');
  if (o.b.branches >= BUSINESS_RULES.maxBranches) return fail('Número máximo de filiais.');
  const need = BUSINESS_RULES.branchLevelStep * (o.b.branches + 1);
  if (o.b.level < need) return fail(`Exige nível ${need}.`);
  if (!o.b.manager) return fail('Contrate um gerente antes de expandir.');
  const cost = branchCost(o.def, o.b.branches);
  if (cost > s.balance) return fail(`Saldo insuficiente: precisa de ${formatMoney(cost)}.`);
  o.b.branches++;
  o.b.invested += cost;
  applyTransaction(s, -cost, 'negocio', `Nova filial (${o.b.branches}): ${o.def.name}`, { isSpending: true });
  return OK;
}

function doCompetitor(s: GameState, id: string): ActionResult {
  const o = ownedBusiness(s, id);
  if (!o) return fail('Você não possui este negócio.');
  if (o.b.acquiredCompetitor) return fail('Concorrente já adquirido.');
  if (o.b.level < BUSINESS_RULES.competitorLevel) return fail(`Exige nível ${BUSINESS_RULES.competitorLevel}.`);
  const cost = competitorCost(o.def);
  if (cost > s.balance) return fail(`Saldo insuficiente: precisa de ${formatMoney(cost)}.`);
  o.b.acquiredCompetitor = true;
  o.b.invested += cost;
  applyTransaction(s, -cost, 'negocio', `Aquisição de concorrente: ${o.def.name}`, { isSpending: true });
  return OK;
}

function doSellBusiness(s: GameState, id: string): ActionResult {
  const o = ownedBusiness(s, id);
  if (!o) return fail('Você não possui este negócio.');
  const value = (o.b.invested * BigInt(Math.round(BALANCE.businessResaleRatio * 1000))) / 1000n;
  delete s.businesses[id];
  applyTransaction(s, value, 'negocio', `Venda do negócio ${o.def.name} (${Math.round(BALANCE.businessResaleRatio * 100)}% do investido)`);
  return OK;
}

function doClaimMission(s: GameState, id: string): ActionResult {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) return fail('Missão inexistente.');
  if (s.missions.claimed.includes(id)) return fail('Recompensa já resgatada.');
  const p = missionProgress(s, m, progressContext(s));
  if (!p.done) return fail('Missão ainda não concluída.');
  s.missions.claimed.push(id);
  if (m.reward > 0) applyTransaction(s, BigInt(m.reward), 'recompensa', `Missão: ${m.title}`);
  return OK;
}

function doPrestige(s: GameState): ActionResult {
  const pts = prestigePointsAvailable(s);
  if (pts <= 0) return fail(`Exige patrimônio de ${formatMoney(BigInt(BALANCE.prestige.minNetWorth))} e novos pontos de Legado.`);
  closeFlowPeriod(s);
  const fresh = createInitialState(s.lastRealTime, s.rng.seed);
  const keep = {
    prestige: { points: s.prestige.points + pts, resets: s.prestige.resets + 1 },
    achievements: s.achievements,
    missions: s.missions,
    settings: s.settings,
    tutorialDone: true,
    processedActionIds: s.processedActionIds,
    nextId: s.nextId,
    rng: s.rng,
    createdAt: s.createdAt,
    lastRealTime: s.lastRealTime,
    // O mundo continua: mercado, regiões e relógio de jogo não reiniciam (só o patrimônio do jogador).
    gameTime: s.gameTime,
    market: s.market,
    realEstate: { ...fresh.realEstate, regions: s.realEstate.regions, nextStepAt: s.realEstate.nextStepAt },
    events: { active: [], upcoming: null, nextAt: s.gameTime + BALANCE.events.maxGapMs, history: s.events.history },
    flow: { current: emptyFlow(s.gameTime), history: [] },
    stats: { ...fresh.stats, lifetimeEarned: s.stats.lifetimeEarned, clicks: s.stats.clicks, crisesSurvived: s.stats.crisesSurvived, profitableTrades: s.stats.profitableTrades },
  };
  const previousNetWorth = netWorth(s).total;
  Object.assign(s, fresh, keep);
  recordSummary(s, 0n, 'sistema', `Legado: reinício com +${pts} pontos (patrimônio anterior ${formatMoney(previousNetWorth)})`);
  notify(s, { kind: 'achievement', title: '🏛️ Novo Legado iniciado', detail: `+${pts} pontos: toda renda ×${(1 + (s.prestige.points) * BALANCE.prestige.bonusPerPoint).toFixed(2)}` });
  return OK;
}

function execute(s: GameState, a: Action): ActionResult {
  switch (a.type) {
    case 'click': return doClick(s, a.count ?? 1);
    case 'buyUpgrade': return doBuyUpgrade(s, a.id, a.qty);
    case 'activateBoost': return doBoost(s);
    case 'buyBusiness': return doBuyBusiness(s, a.id, a.qty);
    case 'hireManager': return doHireManager(s, a.id);
    case 'buyMarketing': return doMarketing(s, a.id);
    case 'openBranch': return doBranch(s, a.id);
    case 'acquireCompetitor': return doCompetitor(s, a.id);
    case 'sellBusiness': return doSellBusiness(s, a.id);
    case 'buyAsset': return buyAsset(s, a.id, a.qty);
    case 'sellAsset': return sellAsset(s, a.id, a.qty);
    case 'buyProperty': return buyProperty(s, a.id);
    case 'sellProperty': return sellProperty(s, a.id);
    case 'renovateProperty': return renovateProperty(s, a.id);
    case 'developProperty': return developProperty(s, a.id);
    case 'claimMission': return doClaimMission(s, a.id);
    case 'prestige': return doPrestige(s);
    case 'updateSettings':
      s.settings = { ...s.settings, ...a.patch };
      return OK;
  }
}

const MAX_ACTION_IDS = 200;

/**
 * Ponto de entrada de todas as ações. `actionId` torna a ação idempotente:
 * reenviar a mesma ação (duplo envio, repetição após erro) não a executa de novo.
 */
export function dispatch(s: GameState, action: Action, actionId?: string): ActionResult {
  if (actionId) {
    if (s.processedActionIds.includes(actionId)) return { ok: false, error: 'Ação já processada.', duplicate: true };
  }
  const res = execute(s, action);
  if (res.ok) {
    if (actionId) {
      s.processedActionIds.push(actionId);
      if (s.processedActionIds.length > MAX_ACTION_IDS) s.processedActionIds.splice(0, s.processedActionIds.length - MAX_ACTION_IDS);
    }
    if (action.type !== 'click' && action.type !== 'updateSettings') updateProgress(s);
  }
  return res;
}

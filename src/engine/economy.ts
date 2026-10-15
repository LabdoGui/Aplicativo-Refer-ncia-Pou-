/**
 * Cálculos econômicos PUROS (não alteram o estado).
 * Toda renda/despesa exibida na interface vem daqui, então o que o jogador vê é
 * exatamente o que o motor aplica.
 */
import { ASSET_BY_ID } from './config/assets';
import { BALANCE } from './config/balance';
import { BUSINESSES, BUSINESS_BY_ID, BUSINESS_RULES, type BusinessDef } from './config/businesses';
import { EVENT_BY_ID } from './config/events';
import { PROPERTIES, PROPERTY_BY_ID, REGION_BY_ID, type PropertyDef } from './config/realestate';
import { UPGRADES, UPGRADE_BY_ID } from './config/upgrades';
import { geometricCost, toCents, type Money } from './money';
import type { GameState, Sector } from './types';

// ---------------------------------------------------------------- melhorias

export function upgradeLevel(s: GameState, id: string): number {
  return s.upgrades[id] ?? 0;
}

function sumUpgrade(s: GameState, kind: string, field: string): number {
  let total = 0;
  for (const u of UPGRADES) {
    if (u.effect.kind === kind) total += (u.effect as unknown as Record<string, number>)[field] * upgradeLevel(s, u.id);
  }
  return total;
}

export function upgradeCost(s: GameState, id: string, count = 1): Money {
  const def = UPGRADE_BY_ID[id];
  return geometricCost(def.baseCost * BALANCE.costMultiplier, def.growth, upgradeLevel(s, id), count);
}

// ---------------------------------------------------------------- eventos

export interface EventModifiers {
  revenue: Partial<Record<Sector, number>>;
  expense: Partial<Record<Sector, number>>;
  assetDrift: Partial<Record<Sector, number>>;
  regionDrift: Record<string, number>;
  rent: number;
}

export function eventModifiers(s: GameState): EventModifiers {
  const m: EventModifiers = { revenue: {}, expense: {}, assetDrift: {}, regionDrift: {}, rent: 1 };
  for (const ev of s.events.active) {
    if (s.gameTime < ev.startsAt || s.gameTime >= ev.endsAt) continue;
    const def = EVENT_BY_ID[ev.defId];
    if (!def) continue;
    const e = def.effects;
    for (const [k, v] of Object.entries(e.businessRevenue ?? {})) m.revenue[k as Sector] = (m.revenue[k as Sector] ?? 1) * v;
    for (const [k, v] of Object.entries(e.businessExpense ?? {})) m.expense[k as Sector] = (m.expense[k as Sector] ?? 1) * v;
    for (const [k, v] of Object.entries(e.assetDrift ?? {})) m.assetDrift[k as Sector] = (m.assetDrift[k as Sector] ?? 0) + v;
    for (const [k, v] of Object.entries(e.regionDrift ?? {})) m.regionDrift[k] = (m.regionDrift[k] ?? 0) + v;
    if (e.rentMultiplier) m.rent *= e.rentMultiplier;
  }
  return m;
}

// ---------------------------------------------------------------- multiplicadores globais

export function ownsProperty(s: GameState, id: string): boolean {
  return (s.realEstate.holdings[id]?.units ?? 0) > 0;
}

export function propertyPassiveBonus(s: GameState): number {
  let b = 0;
  for (const p of PROPERTIES) {
    if (!ownsProperty(s, p.id)) continue;
    for (const syn of p.synergies) if (syn.kind === 'passiveMult') b += syn.fraction;
  }
  return b;
}

export function prestigeMultiplier(s: GameState): number {
  return 1 + s.prestige.points * BALANCE.prestige.bonusPerPoint;
}

export function achievementMultiplier(s: GameState): number {
  return 1 + s.achievements.length * BALANCE.achievementBonus;
}

/** Multiplicador sobre toda renda passiva (negócios, robôs, aluguéis). */
export function passiveMultiplier(s: GameState): number {
  return (
    BALANCE.incomeMultiplier *
    (1 + sumUpgrade(s, 'passiveMult', 'fraction') + propertyPassiveBonus(s)) *
    achievementMultiplier(s) *
    prestigeMultiplier(s)
  );
}

export interface MultiplierPart {
  label: string;
  value: string;
}

/** Explica de onde vêm os multiplicadores (transparência para o jogador). */
export function explainPassiveMultiplier(s: GameState): MultiplierPart[] {
  const parts: MultiplierPart[] = [];
  const cons = sumUpgrade(s, 'passiveMult', 'fraction');
  if (cons) parts.push({ label: 'Consultor financeiro', value: `+${Math.round(cons * 100)}%` });
  const prop = propertyPassiveBonus(s);
  if (prop) parts.push({ label: 'Imóveis estratégicos', value: `+${Math.round(prop * 100)}%` });
  if (s.achievements.length) parts.push({ label: `${s.achievements.length} conquistas`, value: `×${achievementMultiplier(s).toFixed(2)}` });
  if (s.prestige.points) parts.push({ label: `Legado (${s.prestige.points} pts)`, value: `×${prestigeMultiplier(s).toFixed(2)}` });
  return parts;
}

// ---------------------------------------------------------------- negócios

export function isBusinessUnlocked(s: GameState, def: BusinessDef, netWorthCents: Money): boolean {
  if (s.businesses[def.id]?.level) return true;
  if (netWorthCents < BigInt(def.unlockNetWorth)) return false;
  return businessRequirementMissing(s, def) === null;
}

/** Requisito não financeiro que ainda falta (ou null). */
export function businessRequirementMissing(s: GameState, def: BusinessDef): string | null {
  const needers = PROPERTIES.filter((p) => p.synergies.some((x) => x.kind === 'unlockBusiness' && x.businessId === def.id));
  if (needers.length && !needers.some((p) => ownsProperty(s, p.id))) {
    return `Exige possuir: ${needers.map((p) => p.name).join(' ou ')}`;
  }
  return null;
}

function milestoneMultiplier(level: number): number {
  let m = 1;
  for (const ms of BALANCE.levelMilestones) if (level >= ms) m *= 2;
  return m;
}

export function nextMilestone(level: number): number | null {
  for (const ms of BALANCE.levelMilestones) if (level < ms) return ms;
  return null;
}

function sectorEventMultiplier(raw: number | undefined, def: BusinessDef): number {
  if (raw === undefined) return 1;
  let delta = raw - 1;
  delta *= def.eventSensitivity ?? 1;
  if (def.defensive && delta < 0) delta *= 0.5;
  return Math.max(0.05, 1 + delta);
}

export function groupBonus(s: GameState, exceptId: string): number {
  let b = 0;
  for (const def of BUSINESSES) {
    if (def.id === exceptId || !def.groupBonusPerLevel) continue;
    b += def.groupBonusPerLevel * (s.businesses[def.id]?.level ?? 0);
  }
  return 1 + b;
}

export interface BusinessFinancials {
  revenue: number; // centavos/s
  operating: number; // despesas operacionais centavos/s
  salary: number; // salário do gerente centavos/s
  expenses: number; // total
  profit: number;
  staff: number;
  eventRevenueMult: number;
  eventExpenseMult: number;
}

export function businessFinancials(
  s: GameState,
  id: string,
  override?: Partial<{ level: number; manager: boolean; marketing: number; branches: number; acquiredCompetitor: boolean }>,
  mods: EventModifiers = eventModifiers(s),
): BusinessFinancials {
  const def = BUSINESS_BY_ID[id];
  const base = s.businesses[id];
  const st = {
    level: override?.level ?? base?.level ?? 0,
    manager: override?.manager ?? base?.manager ?? false,
    marketing: override?.marketing ?? base?.marketing ?? 0,
    branches: override?.branches ?? base?.branches ?? 0,
    acquiredCompetitor: override?.acquiredCompetitor ?? base?.acquiredCompetitor ?? false,
  };
  if (!def || st.level <= 0) {
    return { revenue: 0, operating: 0, salary: 0, expenses: 0, profit: 0, staff: 0, eventRevenueMult: 1, eventExpenseMult: 1 };
  }
  const evRev = sectorEventMultiplier(mods.revenue[def.sector], def);
  const evExp = mods.expense[def.sector] ?? 1;
  let synergyRev = 1;
  let synergyExp = 1;
  for (const p of PROPERTIES) {
    if (!ownsProperty(s, p.id)) continue;
    for (const syn of p.synergies) {
      if (syn.kind === 'businessRevenue' && syn.businessId === id) synergyRev += syn.fraction;
      if (syn.kind === 'businessExpense' && syn.businessId === id) synergyExp -= syn.fraction;
    }
  }
  const revenue =
    def.baseRevenue *
    st.level *
    milestoneMultiplier(st.level) *
    (1 + st.branches) *
    (1 + BUSINESS_RULES.marketingBonus * st.marketing) *
    (st.acquiredCompetitor ? 1 + BUSINESS_RULES.competitorBonus : 1) *
    (st.manager ? 1 : BALANCE.noManagerEfficiency) *
    evRev *
    synergyRev *
    groupBonus(s, id) *
    passiveMultiplier(s);
  const mgmt = Math.min(0.9, sumUpgrade(s, 'expenseReduction', 'fraction'));
  const operating = revenue * def.expenseRatio * evExp * (1 - mgmt) * Math.max(0.1, synergyExp);
  const salary = st.manager ? managerSalary(def, st.branches) : 0;
  const expenses = operating + salary;
  return {
    revenue,
    operating,
    salary,
    expenses,
    profit: revenue - expenses,
    staff: def.staffPerLevel * st.level * (1 + st.branches),
    eventRevenueMult: evRev,
    eventExpenseMult: evExp,
  };
}

export function managerSalary(def: BusinessDef, branches: number): number {
  return def.baseRevenue * BALANCE.managerSalaryFactor * (1 + branches);
}

export function managerHireCost(def: BusinessDef): Money {
  return toCents(def.baseCost * 3 * BALANCE.costMultiplier, 'ceil');
}

/** Custo para subir `count` níveis (o nível 1 é a aquisição). */
export function businessLevelCost(s: GameState, id: string, count = 1): Money {
  const def = BUSINESS_BY_ID[id];
  const level = s.businesses[id]?.level ?? 0;
  return geometricCost(def.baseCost * BALANCE.costMultiplier, def.growth, level, count);
}

export function marketingCost(def: BusinessDef, current: number): Money {
  return toCents(def.baseCost * BUSINESS_RULES.marketingCostFactor * Math.pow(2, current) * BALANCE.costMultiplier, 'ceil');
}

export function branchCost(def: BusinessDef, current: number): Money {
  return toCents(def.baseCost * BUSINESS_RULES.branchCostFactor * Math.pow(3, current) * BALANCE.costMultiplier, 'ceil');
}

export function competitorCost(def: BusinessDef): Money {
  return toCents(def.baseCost * BUSINESS_RULES.competitorCostFactor * BALANCE.costMultiplier, 'ceil');
}

/** Tempo estimado (s) para uma melhoria se pagar. Infinity se não aumenta o lucro. */
export function paybackSeconds(cost: Money, profitGainPerSecond: number): number {
  if (profitGainPerSecond <= 0) return Infinity;
  return Number(cost) / profitGainPerSecond;
}

export function businessValue(s: GameState, id: string): Money {
  const b = s.businesses[id];
  if (!b || b.level <= 0) return 0n;
  return (b.invested * BigInt(Math.round(BALANCE.businessResaleRatio * 1000))) / 1000n;
}

// ---------------------------------------------------------------- imóveis

export function regionIndex(s: GameState, regionId: string): number {
  return s.realEstate.regions[regionId]?.index ?? 1;
}

/** Preço de mercado de uma unidade na posição k (0 = primeira unidade). */
export function propertyUnitPrice(s: GameState, def: PropertyDef, k: number, renovation: number): number {
  return (
    def.basePrice *
    regionIndex(s, def.region) *
    (1 + def.unitPriceStep * k) *
    (1 + BALANCE.realEstate.renovationValueBonus * renovation)
  );
}

export function propertyBuyCost(s: GameState, id: string): { price: Money; fee: Money; total: Money } {
  const def = PROPERTY_BY_ID[id];
  const h = s.realEstate.holdings[id];
  const price = toCents(propertyUnitPrice(s, def, h?.units ?? 0, h?.renovation ?? 0), 'ceil');
  const fee = toCents(Number(price) * BALANCE.realEstate.purchaseFeeRate, 'ceil');
  return { price, fee, total: price + fee };
}

export function propertySaleValue(s: GameState, id: string): { price: Money; fee: Money; net: Money } {
  const def = PROPERTY_BY_ID[id];
  const h = s.realEstate.holdings[id];
  if (!h || h.units <= 0) return { price: 0n, fee: 0n, net: 0n };
  const price = toCents(propertyUnitPrice(s, def, h.units - 1, h.renovation), 'floor');
  const fee = toCents(Number(price) * BALANCE.realEstate.saleFeeRate, 'ceil');
  return { price, fee, net: price - fee };
}

export function propertyMarketValue(s: GameState, id: string): Money {
  const def = PROPERTY_BY_ID[id];
  const h = s.realEstate.holdings[id];
  if (!h || h.units <= 0) return 0n;
  let total = 0;
  for (let k = 0; k < h.units; k++) total += propertyUnitPrice(s, def, k, h.renovation);
  return toCents(total, 'floor');
}

export function renovationCost(s: GameState, id: string): Money {
  const def = PROPERTY_BY_ID[id];
  const h = s.realEstate.holdings[id];
  const units = h?.units ?? 0;
  return toCents(def.basePrice * 0.25 * ((h?.renovation ?? 0) + 1) * units * BALANCE.costMultiplier, 'ceil');
}

export interface PropertyFinancials {
  rent: number;
  maintenance: number;
  net: number;
}

export function propertyFinancials(s: GameState, id: string, mods: EventModifiers = eventModifiers(s)): PropertyFinancials {
  const def = PROPERTY_BY_ID[id];
  const h = s.realEstate.holdings[id];
  if (!def || !h || h.units <= 0) return { rent: 0, maintenance: 0, net: 0 };
  const region = REGION_BY_ID[def.region];
  const rent =
    def.baseRent *
    h.units *
    (1 + BALANCE.realEstate.renovationRentBonus * h.renovation) *
    region.rentMultiplier *
    Math.sqrt(regionIndex(s, def.region)) *
    mods.rent *
    passiveMultiplier(s);
  const maintenance = def.maintenance * h.units * (1 + 0.1 * h.renovation);
  return { rent, maintenance, net: rent - maintenance };
}

// ---------------------------------------------------------------- clique e renda total

export function clickBaseValue(s: GameState): number {
  const flat = BALANCE.baseClick + sumUpgrade(s, 'clickFlat', 'cents');
  let mult = 1;
  for (const u of UPGRADES) if (u.effect.kind === 'clickMult') mult *= Math.pow(u.effect.factor, upgradeLevel(s, u.id));
  return flat * mult * prestigeMultiplier(s) * BALANCE.incomeMultiplier;
}

export function isBoostActive(s: GameState): boolean {
  return s.gameTime < s.boost.activeUntil;
}

export interface IncomeBreakdown {
  /** Entradas por fonte (centavos/s). */
  sources: Record<string, number>;
  /** Saídas por fonte (centavos/s, valores positivos). */
  costs: Record<string, number>;
  income: number;
  expenses: number;
  net: number;
  /** Renda passiva líquida sem automação de cliques (base do clique inteligente). */
  passiveNet: number;
}

export function incomeBreakdown(s: GameState, mods: EventModifiers = eventModifiers(s)): IncomeBreakdown {
  const sources: Record<string, number> = {};
  const costs: Record<string, number> = {};
  const pm = passiveMultiplier(s);
  const flat = sumUpgrade(s, 'passiveFlat', 'centsPerSecond');
  if (flat > 0) sources['Robôs e geradores'] = flat * pm;
  for (const def of BUSINESSES) {
    const f = businessFinancials(s, def.id, undefined, mods);
    if (f.revenue > 0) sources[def.name] = f.revenue;
    if (f.expenses > 0) costs[def.name] = f.expenses;
  }
  for (const p of PROPERTIES) {
    const f = propertyFinancials(s, p.id, mods);
    if (f.rent > 0) sources[`Aluguel: ${p.name}`] = f.rent;
    if (f.maintenance > 0) costs[`Manutenção: ${p.name}`] = f.maintenance;
  }
  let income = Object.values(sources).reduce((a, b) => a + b, 0);
  const expenses = Object.values(costs).reduce((a, b) => a + b, 0);
  const passiveNet = income - expenses;
  const autoClicks = sumUpgrade(s, 'autoClick', 'perSecond');
  if (autoClicks > 0) {
    const v = autoClicks * clickValue(s, passiveNet);
    sources['Automação de cliques'] = v;
    income += v;
  }
  return { sources, costs, income, expenses, net: income - expenses, passiveNet };
}

/** Valor de um clique em centavos (number). */
export function clickValue(s: GameState, passiveNet?: number): number {
  const net = passiveNet ?? incomeBreakdown(s).passiveNet;
  const fromPassive = sumUpgrade(s, 'clickFromPassive', 'fraction') * Math.max(0, net);
  const boost = isBoostActive(s) ? BALANCE.boost.multiplier : 1;
  return (clickBaseValue(s) + fromPassive) * boost;
}

// ---------------------------------------------------------------- patrimônio

export interface NetWorthBreakdown {
  cash: Money;
  stocks: Money;
  crypto: Money;
  realEstate: Money;
  businesses: Money;
  debt: Money;
  total: Money;
}

export function holdingValue(s: GameState, assetId: string): Money {
  const h = s.portfolio[assetId];
  const a = s.market.assets[assetId];
  if (!h || !a) return 0n;
  return a.price * BigInt(h.qty);
}

export function netWorth(s: GameState): NetWorthBreakdown {
  let stocks = 0n;
  let crypto = 0n;
  for (const id of Object.keys(s.portfolio)) {
    const v = holdingValue(s, id);
    if (ASSET_BY_ID[id]?.kind === 'crypto') crypto += v;
    else stocks += v;
  }
  let realEstate = 0n;
  for (const p of PROPERTIES) realEstate += propertyMarketValue(s, p.id);
  let businesses = 0n;
  for (const b of BUSINESSES) businesses += businessValue(s, b.id);
  const total = s.balance + stocks + crypto + realEstate + businesses - s.debt;
  return { cash: s.balance, stocks, crypto, realEstate, businesses, debt: s.debt, total };
}

/**
 * Pontos de Legado: baseados em TODO o dinheiro ganho na história do jogador
 * (nunca zera), menos os pontos já recebidos. Exige patrimônio mínimo na partida atual.
 */
export function prestigePointsAvailable(s: GameState): number {
  if (Number(s.stats.peakNetWorth) < BALANCE.prestige.minNetWorth) return 0;
  const total = Math.floor(Math.sqrt(Number(s.stats.lifetimeEarned) / BALANCE.prestige.unit));
  return Math.max(0, total - s.prestige.points);
}

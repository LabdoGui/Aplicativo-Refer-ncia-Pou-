import { ASSETS } from './config/assets';
import { BALANCE } from './config/balance';
import { REGIONS } from './config/realestate';
import { toCents } from './money';
import type { AssetState, FlowPeriod, GameState, RegionState } from './types';

export const SAVE_VERSION = 1;

export function emptyFlow(start: number): FlowPeriod {
  return { start, end: start, sources: {}, income: 0, expenses: 0, credited: 0n, clickEarned: 0n, clicks: 0 };
}

export function initialAssetState(basePrice: number): AssetState {
  return { price: toCents(basePrice), fundamental: basePrice, momentum: 0, history: [basePrice], openPrice: basePrice };
}

export function initialRegionState(): RegionState {
  return { index: 1, phase: 0, history: [1] };
}

export function createInitialState(now: number = Date.now(), seed: number = (now ^ 0x5bd1e995) | 0): GameState {
  const assets: Record<string, AssetState> = {};
  for (const a of ASSETS) assets[a.id] = initialAssetState(a.basePrice);
  const regions: Record<string, RegionState> = {};
  for (const r of REGIONS) regions[r.id] = initialRegionState();

  return {
    version: SAVE_VERSION,
    createdAt: now,
    gameTime: 0,
    lastRealTime: now,
    balance: BigInt(BALANCE.startingCash),
    carry: 0,
    debt: 0n,
    stats: {
      clicks: 0,
      clickEarned: 0n,
      totalEarned: 0n,
      totalSpent: 0n,
      peakNetWorth: BigInt(BALANCE.startingCash),
      lifetimeEarned: 0n,
      profitableTrades: 0,
      crisesSurvived: 0,
    },
    upgrades: {},
    boost: { activeUntil: 0, cooldownUntil: 0 },
    businesses: {},
    market: {
      assets,
      stepCount: 0,
      nextStepAt: BALANCE.market.stepMs,
      regime: { kind: 'neutro', until: 600_000 },
      news: [],
    },
    portfolio: {},
    realizedPnL: { stock: 0n, crypto: 0n },
    dividendsReceived: 0n,
    realEstate: {
      holdings: {},
      regions,
      developments: [],
      nextStepAt: BALANCE.realEstate.stepMs,
      realizedPnL: 0n,
    },
    events: { active: [], upcoming: null, nextAt: BALANCE.events.maxGapMs, history: [] },
    missions: { claimed: [] },
    achievements: [],
    ledger: [],
    flow: { current: emptyFlow(0), history: [] },
    prestige: { points: 0, resets: 0 },
    rng: { seed },
    processedActionIds: [],
    nextId: 1,
    settings: { animations: true, sound: false, reduceMotion: false, compactNumbers: true },
    tutorialDone: false,
    notices: [],
  };
}

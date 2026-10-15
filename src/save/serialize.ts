/**
 * Serialização do estado: JSON com bigint marcado ({"$b":"123"}),
 * envelope com versão, data e checksum (detecta arquivo truncado/corrompido).
 */
import { ASSETS } from '../engine/config/assets';
import { REGIONS } from '../engine/config/realestate';
import { SAVE_VERSION, createInitialState, initialAssetState, initialRegionState } from '../engine/state';
import type { GameState } from '../engine/types';
import { migrate } from './migrations';

export const SAVE_FORMAT = 'tycoon-empire-save';

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: number;
  checksum: string;
  data: string;
}

export class SaveError extends Error {}

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? { $b: value.toString() } : value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (typeof o.$b === 'string' && Object.keys(o).length === 1) {
      if (!/^-?\d+$/.test(o.$b)) throw new SaveError('Valor monetário corrompido.');
      return BigInt(o.$b);
    }
  }
  return value;
}

/** FNV-1a 32 bits — suficiente para detectar corrupção acidental (não é proteção contra trapaça). */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function serializeState(state: GameState, savedAt = Date.now()): string {
  validateState(state); // nunca grava um estado inválido
  const { notices: _omit, ...persisted } = state;
  void _omit;
  const data = JSON.stringify(persisted, replacer);
  const env: SaveEnvelope = { format: SAVE_FORMAT, version: state.version, savedAt, checksum: checksum(data), data };
  return JSON.stringify(env);
}

export interface ParsedSave {
  state: GameState;
  savedAt: number;
  migratedFrom: number | null;
}

export function deserializeState(text: string): ParsedSave {
  if (!text || typeof text !== 'string') throw new SaveError('Salvamento vazio.');
  let env: SaveEnvelope;
  try {
    env = JSON.parse(text);
  } catch {
    throw new SaveError('Salvamento ilegível (JSON inválido).');
  }
  if (!env || env.format !== SAVE_FORMAT || typeof env.data !== 'string') throw new SaveError('Formato de salvamento desconhecido.');
  if (checksum(env.data) !== env.checksum) throw new SaveError('Checksum não confere: salvamento corrompido.');
  if (typeof env.version !== 'number' || env.version > SAVE_VERSION) {
    throw new SaveError(`Salvamento de versão mais nova (${env.version}) que o jogo (${SAVE_VERSION}).`);
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(env.data, reviver);
  } catch (e) {
    throw new SaveError(e instanceof SaveError ? e.message : 'Dados do salvamento ilegíveis.');
  }
  const from = env.version;
  if (from < SAVE_VERSION) raw = migrate(raw, from, SAVE_VERSION);
  const state = normalizeState(raw);
  validateState(state);
  return { state, savedAt: env.savedAt, migratedFrom: from < SAVE_VERSION ? from : null };
}

/**
 * Completa campos ausentes com valores padrão e sincroniza com a configuração atual
 * (novos ativos/regiões adicionados ao jogo aparecem em saves antigos; ids removidos somem).
 */
export function normalizeState(raw: Record<string, unknown>): GameState {
  const base = createInitialState(typeof raw.createdAt === 'number' ? raw.createdAt : Date.now());
  const s = { ...base, ...raw } as GameState;
  s.stats = { ...base.stats, ...(s.stats ?? {}) };
  s.settings = { ...base.settings, ...(s.settings ?? {}) };
  s.boost = { ...base.boost, ...(s.boost ?? {}) };
  s.market = { ...base.market, ...(s.market ?? {}) };
  s.realEstate = { ...base.realEstate, ...(s.realEstate ?? {}) };
  s.events = { ...base.events, ...(s.events ?? {}) };
  s.flow = s.flow ?? base.flow;
  s.missions = s.missions ?? base.missions;
  s.prestige = { ...base.prestige, ...(s.prestige ?? {}) };
  s.realizedPnL = { ...base.realizedPnL, ...(s.realizedPnL ?? {}) };

  const assets = { ...s.market.assets };
  for (const a of ASSETS) if (!assets[a.id]) assets[a.id] = initialAssetState(a.basePrice);
  for (const id of Object.keys(assets)) if (!ASSETS.some((a) => a.id === id)) delete assets[id];
  s.market.assets = assets;
  const regions = { ...s.realEstate.regions };
  for (const r of REGIONS) if (!regions[r.id]) regions[r.id] = initialRegionState();
  s.realEstate.regions = regions;
  s.notices = [];
  return s;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new SaveError(`Salvamento inválido: ${msg}`);
}

/** Validação estrutural. Lança SaveError se o estado não for seguro para usar ou gravar. */
export function validateState(s: GameState): void {
  assert(s && typeof s === 'object', 'estado ausente');
  assert(typeof s.version === 'number', 'versão');
  assert(typeof s.balance === 'bigint' && s.balance >= 0n, 'saldo');
  assert(typeof s.debt === 'bigint' && s.debt >= 0n, 'dívida');
  assert(Number.isFinite(s.gameTime) && s.gameTime >= 0, 'tempo de jogo');
  assert(Number.isFinite(s.lastRealTime), 'relógio');
  assert(Number.isFinite(s.carry), 'fração de centavo');
  assert(s.upgrades && typeof s.upgrades === 'object', 'melhorias');
  for (const [id, lvl] of Object.entries(s.upgrades)) assert(Number.isInteger(lvl) && lvl >= 0, `nível de ${id}`);
  assert(s.businesses && typeof s.businesses === 'object', 'negócios');
  for (const [id, b] of Object.entries(s.businesses)) {
    assert(Number.isInteger(b.level) && b.level >= 0, `nível do negócio ${id}`);
    assert(typeof b.invested === 'bigint', `investimento de ${id}`);
  }
  assert(s.portfolio && typeof s.portfolio === 'object', 'carteira');
  for (const [id, h] of Object.entries(s.portfolio)) {
    assert(Number.isInteger(h.qty) && h.qty >= 0, `quantidade de ${id}`);
    assert(typeof h.costBasis === 'bigint', `custo de ${id}`);
  }
  for (const [id, a] of Object.entries(s.market.assets)) {
    assert(typeof a.price === 'bigint' && a.price > 0n, `preço de ${id}`);
    assert(Array.isArray(a.history), `histórico de ${id}`);
  }
  for (const [id, h] of Object.entries(s.realEstate.holdings)) {
    assert(Number.isInteger(h.units) && h.units >= 0, `unidades de ${id}`);
  }
  assert(Array.isArray(s.ledger), 'histórico financeiro');
  assert(Array.isArray(s.achievements), 'conquistas');
  assert(s.rng && Number.isFinite(s.rng.seed), 'gerador aleatório');
}

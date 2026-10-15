import { describe, expect, it } from 'vitest';
import { dispatch } from '../engine/actions';
import { reais } from '../engine/money';
import { advance, applyOffline } from '../engine/simulation';
import { SAVE_VERSION, createInitialState } from '../engine/state';
import { migrate } from './migrations';
import { KEYS, SaveManager } from './saveManager';
import { SaveError, checksum, deserializeState, serializeState } from './serialize';
import { MemoryStorage } from './storage';

const T0 = 1_700_000_000_000;

function played() {
  const s = createInitialState(T0, 99);
  s.balance = reais(50_000);
  dispatch(s, { type: 'buyUpgrade', id: 'robo', qty: 5 });
  dispatch(s, { type: 'buyBusiness', id: 'loja', qty: 4 });
  dispatch(s, { type: 'buyAsset', id: 'vrd', qty: 12 });
  advance(s, 120_000);
  return s;
}

describe('serialização', () => {
  it('ida e volta preserva todos os valores (inclusive bigint)', () => {
    const s = played();
    const back = deserializeState(serializeState(s)).state;
    expect(back.balance).toBe(s.balance);
    expect(back.portfolio.vrd).toEqual(s.portfolio.vrd);
    expect(back.businesses.loja).toEqual(s.businesses.loja);
    expect(back.market.assets.nbt.price).toBe(s.market.assets.nbt.price);
    expect(back.ledger.length).toBe(s.ledger.length);
    expect(back.rng.seed).toBe(s.rng.seed);
  });

  it('detecta salvamento corrompido ou truncado', () => {
    const text = serializeState(played());
    expect(() => deserializeState(text.slice(0, text.length / 2))).toThrow(SaveError);
    const env = JSON.parse(text);
    env.data = env.data.replace('"balance"', '"balancx"');
    expect(() => deserializeState(JSON.stringify(env))).toThrow(/Checksum/);
    expect(() => deserializeState('')).toThrow(SaveError);
    expect(() => deserializeState('{"format":"outro"}')).toThrow(SaveError);
  });

  it('recusa gravar estado inválido', () => {
    const s = played();
    s.balance = -1n;
    expect(() => serializeState(s)).toThrow(SaveError);
  });

  it('recusa salvamento de versão futura', () => {
    const env = JSON.parse(serializeState(played()));
    env.version = SAVE_VERSION + 1;
    expect(() => deserializeState(JSON.stringify(env))).toThrow(/mais nova/);
  });

  it('migra saves antigos (v0 → atual)', () => {
    const s = played();
    const env = JSON.parse(serializeState(s));
    const data = JSON.parse(env.data);
    delete data.debt;
    delete data.stats.crisesSurvived;
    data.version = 0;
    env.data = JSON.stringify(data);
    env.version = 0;
    env.checksum = checksum(env.data);
    const parsed = deserializeState(JSON.stringify(env));
    expect(parsed.migratedFrom).toBe(0);
    expect(parsed.state.version).toBe(SAVE_VERSION);
    expect(parsed.state.debt).toBe(0n);
    expect(parsed.state.stats.crisesSurvived).toBe(0);
    expect(parsed.state.balance).toBe(s.balance);
  });

  it('cadeia de migrações aplica em ordem e falha se faltar um passo', () => {
    const reg = { 1: (r: Record<string, unknown>) => ({ ...r, a: 1 }), 2: (r: Record<string, unknown>) => ({ ...r, b: (r.a as number) + 1 }) };
    expect(migrate({}, 1, 3, reg)).toMatchObject({ a: 1, b: 2, version: 3 });
    expect(() => migrate({}, 0, 3, reg)).toThrow();
  });
});

describe('SaveManager', () => {
  it('salva e carrega a partida', async () => {
    const mgr = new SaveManager(new MemoryStorage());
    const s = played();
    await mgr.save(s);
    const r = await mgr.load();
    expect(r.source).toBe('main');
    expect(r.state!.balance).toBe(s.balance);
  });

  it('recupera do backup quando o principal está corrompido, preservando a cópia ruim', async () => {
    const storage = new MemoryStorage();
    let now = T0;
    const mgr = new SaveManager(storage, () => now);
    const s = played();
    await mgr.save(s); // primeiro save
    now += 6 * 60_000;
    await mgr.save(s); // rotaciona: backup = save anterior
    await storage.set(KEYS.main, '{lixo');
    const r = await new SaveManager(storage).load();
    expect(r.source).toBe('backup');
    expect(r.state!.balance).toBe(s.balance);
    expect(await storage.get(KEYS.corrupt)).toBe('{lixo');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('sem nada válido retorna "none" sem apagar dados', async () => {
    const storage = new MemoryStorage();
    await storage.set(KEYS.main, 'quebrado');
    const r = await new SaveManager(storage).load();
    expect(r.state).toBeNull();
    expect(await storage.get(KEYS.corrupt)).toBe('quebrado');
  });

  it('nunca substitui um save válido por um estado inválido', async () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage);
    const s = played();
    await mgr.save(s);
    const good = await storage.get(KEYS.main);
    const bad = structuredClone(s);
    bad.balance = -5n;
    expect(() => mgr.save(bad)).toThrow();
    expect(await storage.get(KEYS.main)).toBe(good);
  });

  it('salvamentos simultâneos não se intercalam e o último vence', async () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage);
    const s = played();
    const a = structuredClone(s);
    const b = structuredClone(s);
    b.balance += 777n;
    await Promise.all([mgr.save(a), mgr.save(b)]);
    const r = await mgr.load();
    expect(r.state!.balance).toBe(b.balance);
  });

  it('fluxo completo: jogar, salvar, fechar, reabrir após 1h e conferir valores', async () => {
    const storage = new MemoryStorage();
    const s = played();
    s.lastRealTime = T0;
    await new SaveManager(storage).save(s);
    // "Fecha" o jogo. Reabre 1h depois em uma nova instância.
    const r = await new SaveManager(storage).load();
    const loaded = r.state!;
    expect(loaded.portfolio.vrd.qty).toBe(12);
    expect(loaded.businesses.loja.level).toBe(4);
    expect(loaded.upgrades.robo).toBe(5);
    const before = loaded.balance;
    const rep = applyOffline(loaded, T0 + 3_600_000)!;
    expect(loaded.balance > before).toBe(true);
    expect(rep.creditedMs).toBe(3_600_000);
    // Salva de novo e reabre: nada duplicado.
    await new SaveManager(storage).save(loaded);
    const again = (await new SaveManager(storage).load()).state!;
    expect(applyOffline(again, T0 + 3_600_000)).toBeNull();
    expect(again.balance).toBe(loaded.balance);
  });

  it('importação inválida não altera o jogo', async () => {
    const mgr = new SaveManager(new MemoryStorage());
    await expect(mgr.importSave('não é um save')).rejects.toThrow();
  });
});

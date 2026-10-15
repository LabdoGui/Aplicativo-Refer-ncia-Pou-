/**
 * Migrações de salvamento: MIGRATIONS[n] converte dados da versão n para n+1.
 * Ao mudar o formato do estado:
 *   1. Aumente SAVE_VERSION em engine/state.ts.
 *   2. Adicione aqui a função que converte da versão anterior.
 *   3. Adicione um teste em save.test.ts com um save da versão antiga.
 * Campos simplesmente NOVOS não precisam de migração: normalizeState preenche padrões.
 */
type Raw = Record<string, unknown>;
export type Migration = (raw: Raw) => Raw;

export const MIGRATIONS: Record<number, Migration> = {
  // Versão 0 = protótipo interno sem dívida nem estatísticas de trades.
  0: (raw) => ({
    ...raw,
    debt: raw.debt ?? 0n,
    stats: { profitableTrades: 0, crisesSurvived: 0, ...((raw.stats as Raw) ?? {}) },
    version: 1,
  }),
};

export function migrate(raw: Raw, from: number, to: number, registry: Record<number, Migration> = MIGRATIONS): Raw {
  let data = raw;
  for (let v = from; v < to; v++) {
    const fn = registry[v];
    if (!fn) throw new Error(`Sem migração da versão ${v} para ${v + 1}.`);
    data = fn(data);
    data.version = v + 1;
  }
  return data;
}

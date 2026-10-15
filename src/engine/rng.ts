/**
 * Gerador pseudoaleatório determinístico (mulberry32) cujo estado fica salvo no jogo.
 * Consequências úteis:
 * - Simulações offline e testes são reproduzíveis.
 * - Recarregar a página não "rola os dados de novo" (sem save-scumming de eventos/preços).
 */
export interface RngState {
  seed: number;
}

export function nextRandom(rng: RngState): number {
  let t = (rng.seed = (rng.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Normal padrão (Box–Muller). */
export function nextGaussian(rng: RngState): number {
  let u = 0;
  while (u === 0) u = nextRandom(rng);
  const v = nextRandom(rng);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randomRange(rng: RngState, min: number, max: number): number {
  return min + (max - min) * nextRandom(rng);
}

export function pickWeighted<T extends { weight: number }>(rng: RngState, items: readonly T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = nextRandom(rng) * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

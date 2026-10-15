/**
 * Dinheiro do jogo: sempre em CENTAVOS inteiros, representados como bigint.
 * Isso elimina erros de ponto flutuante em saldos, compras e vendas, e permite
 * valores arbitrariamente grandes (trilhões, quatrilhões...).
 *
 * Taxas (renda por segundo, multiplicadores) continuam como number; a conversão
 * para centavos acontece em um único ponto (toCents / mulRate) com arredondamento
 * explícito.
 */
export type Money = bigint;

export const ZERO: Money = 0n;

/** Converte reais (number) para centavos. Ex.: reais(1.5) === 150n */
export function reais(value: number): Money {
  return toCents(value * 100);
}

/** Converte um valor em centavos (number, pode ter fração) para Money, arredondando. */
export function toCents(cents: number, mode: 'round' | 'floor' | 'ceil' = 'round'): Money {
  if (!Number.isFinite(cents)) {
    throw new RangeError(`Valor monetário inválido: ${cents}`);
  }
  const r = mode === 'floor' ? Math.floor(cents) : mode === 'ceil' ? Math.ceil(cents) : Math.round(cents);
  return BigInt(r);
}

/** Converte Money para number (para gráficos e cálculos de taxa; pode perder precisão em valores enormes). */
export function toNumber(m: Money): number {
  return Number(m);
}

const RATE_SCALE = 1_000_000n;

/** Multiplica dinheiro por uma taxa com 6 casas decimais de precisão, arredondando para baixo. */
export function mulRate(m: Money, rate: number): Money {
  if (!Number.isFinite(rate)) throw new RangeError(`Taxa inválida: ${rate}`);
  const scaled = BigInt(Math.round(rate * 1_000_000));
  return (m * scaled) / RATE_SCALE;
}

/** Multiplica por taxa arredondando para cima (usado em taxas cobradas do jogador: nunca cobra menos que o anunciado). */
export function mulRateCeil(m: Money, rate: number): Money {
  if (!Number.isFinite(rate)) throw new RangeError(`Taxa inválida: ${rate}`);
  const scaled = BigInt(Math.round(rate * 1_000_000));
  const num = m * scaled;
  const q = num / RATE_SCALE;
  return num % RATE_SCALE === 0n ? q : q + 1n;
}

export function maxMoney(a: Money, b: Money): Money {
  return a > b ? a : b;
}
export function minMoney(a: Money, b: Money): Money {
  return a < b ? a : b;
}

const SUFFIXES: [number, string, string][] = [
  // [expoente de 10, abreviação, nome por extenso]
  [33, 'dc', 'decilhões'],
  [30, 'nn', 'nonilhões'],
  [27, 'oc', 'octilhões'],
  [24, 'sp', 'septilhões'],
  [21, 'sx', 'sextilhões'],
  [18, 'qi', 'quintilhões'],
  [15, 'qa', 'quatrilhões'],
  [12, 'tri', 'trilhões'],
  [9, 'bi', 'bilhões'],
  [6, 'mi', 'milhões'],
  [3, 'mil', 'mil'],
];

function formatPlain(reaisInt: bigint, cents: bigint, showCents: boolean): string {
  const s = reaisInt.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return showCents ? `${s},${cents.toString().padStart(2, '0')}` : s;
}

/**
 * Formata centavos em texto legível em pt-BR.
 * - Abaixo de R$ 100 mil: valor completo com centavos (R$ 1.234,56).
 * - Acima: escala com sufixo (R$ 12,35 mi; R$ 4,20 tri; ...).
 * - Além de decilhões: notação científica.
 */
export function formatMoney(m: Money, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const neg = m < 0n;
  const abs = neg ? -m : m;
  const prefix = neg ? '-R$ ' : opts.sign && abs > 0n ? '+R$ ' : 'R$ ';
  const reaisInt = abs / 100n;
  const cents = abs % 100n;
  const threshold = opts.compact ? 10_000n : 100_000n;
  if (reaisInt < threshold) {
    return prefix + formatPlain(reaisInt, cents, reaisInt < 1000n || !opts.compact);
  }
  const digits = reaisInt.toString().length - 1; // expoente de 10
  for (const [exp, abbr] of SUFFIXES) {
    if (digits >= exp) {
      if (digits >= exp + 3 && exp === 33) break; // grande demais: científica
      // 2 casas decimais com truncamento (nunca mostra mais do que existe)
      const unit = 10n ** BigInt(exp);
      const whole = reaisInt / unit;
      const frac = ((reaisInt % unit) * 100n) / unit;
      return `${prefix}${formatPlain(whole, frac, true)} ${abbr}`;
    }
  }
  const str = reaisInt.toString();
  return `${prefix}${str[0]},${str.slice(1, 3)}e${str.length - 1}`;
}

/** Formata uma taxa em centavos/segundo (number). */
export function formatRate(centsPerSecond: number): string {
  if (!Number.isFinite(centsPerSecond)) return 'R$ ∞/s';
  return `${formatMoney(toCents(centsPerSecond, 'floor'), { compact: true })}/s`;
}

export function formatPercent(fraction: number, digits = 1, sign = false): string {
  if (!Number.isFinite(fraction)) return '—';
  const v = (fraction * 100).toFixed(digits).replace('.', ',');
  return `${sign && fraction > 0 ? '+' : ''}${v}%`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min ${Math.floor(seconds % 60)}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
  const d = Math.floor(seconds / 86400);
  return d > 999 ? '> 999 dias' : `${d}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

/** Soma geométrica de custos: base * g^start + ... + base * g^(start+n-1). Em centavos, arredondado para cima. */
export function geometricCost(baseCents: number, growth: number, start: number, n: number): Money {
  if (n <= 0) return 0n;
  const first = baseCents * Math.pow(growth, start);
  const total = growth === 1 ? first * n : (first * (Math.pow(growth, n) - 1)) / (growth - 1);
  if (!Number.isFinite(total)) throw new RangeError('Custo excede o limite numérico');
  return toCents(total, 'ceil');
}

/** Quantos níveis cabem no orçamento (custo geométrico). */
export function maxAffordable(baseCents: number, growth: number, start: number, budget: Money, cap = 10_000): number {
  if (budget <= 0n) return 0;
  const first = baseCents * Math.pow(growth, start);
  if (!Number.isFinite(first)) return 0;
  const b = Number(budget);
  let n =
    growth === 1 ? Math.floor(b / first) : Math.floor(Math.log((b * (growth - 1)) / first + 1) / Math.log(growth));
  n = Math.max(0, Math.min(cap, Number.isFinite(n) ? n : 0));
  // Ajuste fino com aritmética exata (evita erro de arredondamento na fronteira)
  while (n > 0 && geometricCost(baseCents, growth, start, n) > budget) n--;
  while (n < cap && geometricCost(baseCents, growth, start, n + 1) <= budget) n++;
  return n;
}

import { splitPath } from '../http/request-path';

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Segundos até a janela atual terminar (mínimo 1). */
  resetSeconds: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

export interface FixedWindowOptions {
  windowMs: number;
  max: number;
}

/**
 * Limite em memória por janela fixa: cada chave (ex.: IP) pode fazer `max`
 * requisições a partir da primeira, até a janela de `windowMs` terminar.
 * O relógio é injetável para testes. Basta para uma instância do gateway;
 * com várias réplicas, o estado precisaria ir para um armazenamento comum.
 */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, WindowEntry>();

  constructor(
    private readonly options: FixedWindowOptions,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): RateLimitDecision {
    const now = this.now();
    let entry = this.entries.get(key);
    if (!entry || now - entry.windowStart >= this.options.windowMs) {
      entry = { count: 0, windowStart: now };
      this.entries.set(key, entry);
    }
    // Não passa de max + 1: evita contar indefinidamente quem insiste.
    if (entry.count <= this.options.max) entry.count += 1;

    const resetMs = entry.windowStart + this.options.windowMs - now;
    return {
      allowed: entry.count <= this.options.max,
      limit: this.options.max,
      remaining: Math.max(0, this.options.max - entry.count),
      resetSeconds: Math.max(1, Math.ceil(resetMs / 1000)),
    };
  }

  /** Remove janelas já encerradas. Retorna quantas entradas saíram. */
  purgeExpired(): number {
    const now = this.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart >= this.options.windowMs) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.entries.size;
  }
}

export type RateLimitBucket = 'auth' | 'default' | 'exempt';

/** Rotas de credencial, com limite mais baixo (força bruta, criação de contas em massa). */
const AUTH_ACTIONS = new Set(['login', 'register', 'refresh']);

/** Decide em qual limite a requisição entra. */
export function classifyRateLimit(method: string, pathname: string): RateLimitBucket {
  const segments = splitPath(pathname);
  if (!segments) return 'default';
  if (segments.length === 1 && segments[0] === 'health') return 'exempt';
  const isAuthAction =
    method.toUpperCase() === 'POST' &&
    segments.length === 4 &&
    segments[0] === 'api' &&
    segments[1] === 'v1' &&
    segments[2] === 'auth' &&
    AUTH_ACTIONS.has(segments[3]);
  return isAuthAction ? 'auth' : 'default';
}

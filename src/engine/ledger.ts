/**
 * ÚNICO ponto do jogo que altera o saldo. Toda alteração tem categoria e descrição
 * e fica registrada no histórico financeiro (auditável).
 */
import { BALANCE } from './config/balance';
import type { Money } from './money';
import type { GameState, LedgerCategory, Notice } from './types';

export interface TxOptions {
  breakdown?: Record<string, Money>;
  /** Não registra no histórico (usado para cliques individuais, agregados depois). */
  silent?: boolean;
  /** Conta como gasto em stats.totalSpent. */
  isSpending?: boolean;
}

/**
 * Credita (amount > 0) ou debita (amount < 0) o saldo.
 * Débitos devem ter sido validados antes; se o saldo não cobrir (despesas passivas),
 * o excedente vira dívida operacional — nunca saldo negativo escondido.
 * Créditos abatem dívida antes de entrar no saldo.
 */
export function applyTransaction(
  s: GameState,
  amount: Money,
  category: LedgerCategory,
  description: string,
  opts: TxOptions = {},
): void {
  if (amount === 0n) return;
  if (amount > 0n) {
    let toBalance = amount;
    if (s.debt > 0n) {
      const pay = s.debt < amount ? s.debt : amount;
      s.debt -= pay;
      toBalance -= pay;
    }
    s.balance += toBalance;
    if (category !== 'acao' && category !== 'cripto' && category !== 'imovel' && category !== 'negocio') {
      // Vendas de ativos não contam como "ganho" (é troca de patrimônio por caixa).
      s.stats.totalEarned += amount;
      s.stats.lifetimeEarned += amount;
    }
  } else {
    const cost = -amount;
    if (cost > s.balance) {
      s.debt += cost - s.balance;
      s.balance = 0n;
    } else {
      s.balance -= cost;
    }
    if (opts.isSpending) s.stats.totalSpent += cost;
  }
  if (!opts.silent) {
    s.ledger.push({
      id: s.nextId++,
      at: s.gameTime,
      realAt: Date.now(),
      category,
      description,
      amount,
      balanceAfter: s.balance,
      breakdown: opts.breakdown,
    });
    if (s.ledger.length > BALANCE.ledgerLimit) s.ledger.splice(0, s.ledger.length - BALANCE.ledgerLimit);
  }
}

export function notify(s: GameState, notice: Notice): void {
  s.notices.push(notice);
  if (s.notices.length > 20) s.notices.splice(0, s.notices.length - 20);
}

/**
 * Registra no histórico um resumo de valores JÁ aplicados ao saldo
 * (renda passiva e cliques são creditados continuamente e resumidos por período).
 */
export function recordSummary(
  s: GameState,
  amount: Money,
  category: LedgerCategory,
  description: string,
  breakdown?: Record<string, Money>,
): void {
  s.ledger.push({ id: s.nextId++, at: s.gameTime, realAt: Date.now(), category, description, amount, balanceAfter: s.balance, breakdown });
  if (s.ledger.length > BALANCE.ledgerLimit) s.ledger.splice(0, s.ledger.length - BALANCE.ledgerLimit);
}

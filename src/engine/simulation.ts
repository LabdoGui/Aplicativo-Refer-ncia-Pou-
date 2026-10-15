/**
 * Avanço do tempo de jogo. O MESMO código é usado no jogo ativo e no cálculo offline,
 * então as regras econômicas são idênticas nos dois casos.
 */
import { BALANCE } from './config/balance';
import { eventModifiers, incomeBreakdown, netWorth } from './economy';
import { stepEvents } from './events';
import { applyTransaction, recordSummary } from './ledger';
import { stepMarket } from './market';
import { toCents, type Money } from './money';
import { updateProgress } from './progress';
import { completeDevelopments, stepRealEstate } from './realestate';
import { createInitialState, emptyFlow } from './state';
import type { FlowPeriod, GameState } from './types';

const TICK_MS = 1000;

function accrueIncome(s: GameState, dtMs: number, efficiency: number): void {
  const mods = eventModifiers(s);
  const b = incomeBreakdown(s, mods);
  const f = dtMs / 1000;
  const total = b.net * f * efficiency + s.carry;
  const whole = Math.floor(total);
  s.carry = total - whole;
  const credited = toCents(whole);
  if (credited !== 0n) applyTransaction(s, credited, credited > 0n ? 'renda' : 'despesa', 'Renda passiva', { silent: true });

  const fl = s.flow.current;
  fl.credited += credited;
  fl.income += b.income * f * efficiency;
  fl.expenses += b.expenses * f * efficiency;
  for (const [k, v] of Object.entries(b.sources)) fl.sources[k] = (fl.sources[k] ?? 0) + v * f * efficiency;
  for (const [k, v] of Object.entries(b.costs)) fl.sources[k] = (fl.sources[k] ?? 0) - v * f * efficiency;
}

function breakdownToMoney(sources: Record<string, number>): Record<string, Money> {
  const out: Record<string, Money> = {};
  for (const [k, v] of Object.entries(sources)) {
    const m = toCents(v);
    if (m !== 0n) out[k] = m;
  }
  return out;
}

/** Fecha o período de fluxo de caixa atual, registra um resumo no histórico e abre outro. */
export function closeFlowPeriod(s: GameState, label?: string): FlowPeriod {
  const fl = s.flow.current;
  fl.end = s.gameTime;
  if (fl.end > fl.start) {
    const mins = Math.max(1, Math.round((fl.end - fl.start) / 60_000));
    if (fl.credited !== 0n) {
      recordSummary(
        s,
        fl.credited,
        label ? 'offline' : fl.credited > 0n ? 'renda' : 'despesa',
        label ?? `Renda passiva líquida (${mins} min)`,
        breakdownToMoney(fl.sources),
      );
    }
    if (fl.clicks > 0) recordSummary(s, fl.clickEarned, 'clique', `${fl.clicks} cliques no cartão`);
    s.flow.history.push(fl);
    if (s.flow.history.length > BALANCE.flowHistoryLength) s.flow.history.shift();
  }
  s.flow.current = emptyFlow(s.gameTime);
  return fl;
}

export interface AdvanceOptions {
  /** Cálculo offline: aplica eficiência offline e agrega tudo em um único período. */
  offline?: boolean;
}

/** Avança o jogo em `ms` milissegundos de tempo simulado. */
export function advance(s: GameState, ms: number, opts: AdvanceOptions = {}): void {
  if (!(ms > 0) || !Number.isFinite(ms)) return;
  const efficiency = opts.offline ? BALANCE.offline.efficiency : 1;
  let remaining = ms;
  while (remaining > 0) {
    const dt = Math.min(TICK_MS, remaining);
    accrueIncome(s, dt, efficiency);
    s.gameTime += dt;
    remaining -= dt;

    stepEvents(s);
    if (s.gameTime >= s.market.nextStepAt) {
      const mods = eventModifiers(s);
      while (s.gameTime >= s.market.nextStepAt) {
        stepMarket(s, mods);
        s.market.nextStepAt += BALANCE.market.stepMs;
      }
    }
    if (s.gameTime >= s.realEstate.nextStepAt) {
      const mods = eventModifiers(s);
      while (s.gameTime >= s.realEstate.nextStepAt) {
        stepRealEstate(s, mods);
        s.realEstate.nextStepAt += BALANCE.realEstate.stepMs;
      }
    } else if (s.realEstate.developments.length) {
      completeDevelopments(s);
    }
    if (!opts.offline && s.gameTime - s.flow.current.start >= BALANCE.flowPeriodMs) closeFlowPeriod(s);
  }
  updateProgress(s);
}

export interface OfflineReport {
  elapsedMs: number;
  creditedMs: number;
  capped: boolean;
  clockWentBack: boolean;
  income: Money;
  expenses: Money;
  net: Money;
  dividends: Money;
  netWorthBefore: Money;
  netWorthAfter: Money;
  events: string[];
}

/**
 * Aplica o progresso offline com base no relógio real.
 * Proteções:
 * - Usa o MAIOR horário já visto (lastRealTime). Se o relógio voltar, nada é creditado
 *   e o jogo só volta a creditar quando o horário real ultrapassar o já visto.
 * - Limite máximo (BALANCE.offline.capMs): adiantar o relógio rende no máximo isso.
 * - lastRealTime é atualizado no mesmo passo: aplicar duas vezes não credita em dobro.
 */
export function applyOffline(s: GameState, now: number, capMs: number = BALANCE.offline.capMs): OfflineReport | null {
  const elapsed = now - s.lastRealTime;
  const clockWentBack = elapsed < 0;
  if (now > s.lastRealTime) s.lastRealTime = now;
  if (elapsed < 5_000) {
    return clockWentBack
      ? { elapsedMs: elapsed, creditedMs: 0, capped: false, clockWentBack, income: 0n, expenses: 0n, net: 0n, dividends: 0n, netWorthBefore: netWorth(s).total, netWorthAfter: netWorth(s).total, events: [] }
      : null;
  }
  const credited = Math.min(elapsed, capMs);
  const before = netWorth(s).total;
  const divBefore = s.dividendsReceived;
  const histBefore = s.events.history.length;
  const noticesBefore = s.notices.length;

  closeFlowPeriod(s);
  advance(s, credited, { offline: true });
  const fl = closeFlowPeriod(s, `Período offline (${Math.round(credited / 60_000)} min)`);
  // Notificações geradas offline são resumidas no relatório em vez de inundar a tela.
  s.notices.splice(noticesBefore);

  return {
    elapsedMs: elapsed,
    creditedMs: credited,
    capped: elapsed > capMs,
    clockWentBack,
    income: toCents(fl.income, 'floor'),
    expenses: toCents(fl.expenses, 'floor'),
    net: fl.credited,
    dividends: s.dividendsReceived - divBefore,
    netWorthBefore: before,
    netWorthAfter: netWorth(s).total,
    events: s.events.history.slice(histBefore),
  };
}

/**
 * Nova partida com o mercado já "em funcionamento": roda o MESMO modelo de preços
 * por PRE_HISTORY_STEPS passos antes do início, para que gráficos tenham histórico real.
 */
export const PRE_HISTORY_STEPS = 60;

export function newGame(now: number = Date.now(), seed?: number): GameState {
  const s = createInitialState(now, seed);
  const mods = eventModifiers(s);
  for (let i = 0; i < PRE_HISTORY_STEPS; i++) stepMarket(s, mods);
  for (let i = 0; i < PRE_HISTORY_STEPS / 2; i++) stepRealEstate(s, mods);
  s.market.stepCount = 0;
  s.market.news = s.market.news.slice(0, 5);
  return s;
}

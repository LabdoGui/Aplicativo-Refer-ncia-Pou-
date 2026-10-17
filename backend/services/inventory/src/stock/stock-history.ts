import { DateTime } from 'luxon';
import {
  BLOOD_TYPES,
  DEFAULT_TIMEZONE,
  type BloodType,
  type MovementType,
  type StockHistoryPoint,
  type StockTrend,
} from '@pulso/contracts';

/** Movimentação reduzida ao que importa para reconstruir saldos. */
export interface MovementDelta {
  bloodType: BloodType;
  type: MovementType;
  quantity: number;
  occurredAt: Date;
}

export type BalanceByType = Record<BloodType, number>;

export function signedQuantity(movement: Pick<MovementDelta, 'type' | 'quantity'>): number {
  return movement.type === 'IN' ? movement.quantity : -movement.quantity;
}

/** Os últimos `count` dias locais (AAAA-MM-DD), do mais antigo até `today`. */
export function lastLocalDays(count: number, today: string): string[] {
  const end = DateTime.fromISO(today);
  return Array.from({ length: count }, (_, index) =>
    end.minus({ days: count - 1 - index }).toISODate()!,
  );
}

/** Último instante do dia local `date` no fuso informado. */
export function endOfLocalDay(date: string, zone: string = DEFAULT_TIMEZONE): Date {
  return DateTime.fromISO(date, { zone }).endOf('day').toJSDate();
}

export function emptyBalances(): BalanceByType {
  return Object.fromEntries(BLOOD_TYPES.map((type) => [type, 0])) as BalanceByType;
}

/**
 * Saldo no fim de cada dia, reconstruído DE TRÁS PARA FRENTE a partir do saldo
 * atual: o saldo no fim do dia D é o atual menos o efeito das movimentações
 * ocorridas depois de D. Como só usa `occurredAt`, funciona com movimentações
 * registradas com data retroativa (o `balanceAfter` não serve para isso).
 *
 * `movements` precisa conter todas as movimentações posteriores ao fim do
 * primeiro dia de `days` (ordem qualquer); `days` em ordem crescente.
 */
export function reconstructDailyBalances(
  current: BalanceByType,
  movements: MovementDelta[],
  days: string[],
  zone: string = DEFAULT_TIMEZONE,
): StockHistoryPoint[] {
  const sorted = [...movements].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const running: BalanceByType = { ...current };
  const points: StockHistoryPoint[] = [];
  let cursor = 0;
  for (let index = days.length - 1; index >= 0; index--) {
    const limit = endOfLocalDay(days[index], zone).getTime();
    // Desfaz as movimentações que aconteceram depois do fim deste dia.
    while (cursor < sorted.length && sorted[cursor].occurredAt.getTime() > limit) {
      const movement = sorted[cursor];
      running[movement.bloodType] -= signedQuantity(movement);
      cursor++;
    }
    const values = { ...running };
    points.push({
      date: days[index],
      values,
      total: BLOOD_TYPES.reduce((sum, type) => sum + values[type], 0),
    });
  }
  return points.reverse();
}

/** Tendência em relação ao saldo de 7 dias atrás. */
export function computeTrend(current: number, sevenDaysAgo: number): StockTrend {
  const delta7d = current - sevenDaysAgo;
  return {
    delta7d,
    deltaPercent7d: sevenDaysAgo === 0 ? null : Math.round((delta7d / sevenDaysAgo) * 1000) / 10,
    direction: delta7d > 0 ? 'UP' : delta7d < 0 ? 'DOWN' : 'STABLE',
  };
}

/**
 * Menor saldo do tipo entre um instante passado e agora, dado o saldo atual e
 * as movimentações ocorridas depois desse instante. Uma saída retroativa reduz
 * todos esses saldos; se algum ficasse negativo, a saída é impossível.
 */
export function minimumBalanceSince(
  current: number,
  laterMovements: Array<Pick<MovementDelta, 'type' | 'quantity'>>,
): number {
  let running = current;
  let minimum = current;
  // Percorre do mais recente ao mais antigo: o saldo antes de cada movimentação.
  for (const movement of laterMovements) {
    running -= signedQuantity(movement);
    minimum = Math.min(minimum, running);
  }
  return minimum;
}

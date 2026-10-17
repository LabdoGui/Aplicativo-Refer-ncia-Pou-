import { DateTime } from 'luxon';
import { DEFAULT_TIMEZONE } from '@pulso/contracts';

/** Data local (AAAA-MM-DD) de um instante, no fuso informado. */
export function toLocalDate(date: Date | string, zone: string = DEFAULT_TIMEZONE): string {
  const value = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  return value.setZone(zone).toISODate()!;
}

/** Hoje (AAAA-MM-DD) no fuso informado. */
export function todayLocal(zone: string = DEFAULT_TIMEZONE): string {
  return DateTime.now().setZone(zone).toISODate()!;
}

/**
 * Intervalo [início do dia `from`, fim do dia `to`] em UTC, com os dias
 * interpretados no fuso informado. Datas inválidas lançam erro.
 */
export function localDayRange(
  from: string,
  to: string,
  zone: string = DEFAULT_TIMEZONE,
): { start: Date; end: Date } {
  const start = DateTime.fromISO(from, { zone }).startOf('day');
  const end = DateTime.fromISO(to, { zone }).endOf('day');
  if (!start.isValid || !end.isValid) throw new Error('Data inválida');
  return { start: start.toJSDate(), end: end.toJSDate() };
}

/** Lista de dias (AAAA-MM-DD) entre `from` e `to`, inclusive. */
export function eachLocalDay(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = DateTime.fromISO(from);
  const last = DateTime.fromISO(to);
  while (cursor <= last && days.length <= 1_000) {
    days.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
  }
  return days;
}

/** Soma dias a uma data local (AAAA-MM-DD). */
export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date).plus({ days }).toISODate()!;
}

/** Idade completa em anos numa data de referência. */
export function ageOn(birthDate: string, reference: string = todayLocal()): number {
  const birth = DateTime.fromISO(birthDate);
  const ref = DateTime.fromISO(reference);
  return Math.floor(ref.diff(birth, 'years').years);
}

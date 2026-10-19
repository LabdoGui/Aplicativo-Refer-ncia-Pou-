import { DEFAULT_TIMEZONE } from '@pulso/contracts';
import { formatDate, formatLongDate, formatTime } from '@/lib/format';

/** Primeira letra maiúscula ("segunda-feira, 19 de outubro" → "Segunda-feira, 19 de outubro"). */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
}

/** Data longa já capitalizada, para títulos e resumos. */
export function longDate(value: string | Date): string {
  return capitalize(formatLongDate(value));
}

/** Faixa de horário de uma vaga ("08:00 às 08:30"). */
export function timeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} às ${formatTime(endsAt)}`;
}

/** Instante como "17/10/2026 às 14:30" (sem segundos). */
export function dateAtTime(value: string): string {
  return `${formatDate(value)} às ${formatTime(value)}`;
}

/** Meio-dia no fuso das unidades: evita que a data "pule" de dia ao formatar. */
const atNoon = (isoDate: string) => new Date(`${isoDate}T12:00:00-03:00`);

const weekdayShort = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  timeZone: DEFAULT_TIMEZONE,
});
const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: DEFAULT_TIMEZONE });

/** Partes curtas de uma data AAAA-MM-DD para os botões de dia ("seg", "19", "out"). */
export function dayParts(isoDate: string): { weekday: string; day: string; month: string } {
  const date = atNoon(isoDate);
  return {
    weekday: weekdayShort.format(date).replace('.', ''),
    day: String(Number(isoDate.slice(8, 10))),
    month: monthShort.format(date).replace('.', ''),
  };
}

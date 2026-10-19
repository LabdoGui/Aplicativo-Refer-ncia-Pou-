import { DEFAULT_TIMEZONE } from '@pulso/contracts';

const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: DEFAULT_TIMEZONE,
});

const tileFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: DEFAULT_TIMEZONE,
});

/** "19 de junho de 2026", no fuso das unidades. */
export function formatFullDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : fullDateFormatter.format(date);
}

/** Partes para o "calendário" dos cartões: { day: '19', month: 'jun', year: '2026' }. */
export function dateTileParts(value: string): { day: string; month: string; year: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: '—', month: '', year: '' };
  const parts = tileFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return { day: part('day'), month: part('month').replace('.', ''), year: part('year') };
}

/** Diferença em horas entre dois instantes ISO (positiva quando `value` vem depois). */
function hoursAfter(value: string, reference: string): number {
  return (Date.parse(value) - Date.parse(reference)) / 3_600_000;
}

/**
 * Lançamentos e conquistas nascem do registro da doação (alguns minutos ou horas depois
 * do início do atendimento). Considera "do mesmo atendimento" o que caiu numa janela curta.
 */
export function isNearAttendance(value: string | null, attendedAt: string): boolean {
  if (!value) return false;
  const hours = hoursAfter(value, attendedAt);
  return hours >= -2 && hours <= 36;
}

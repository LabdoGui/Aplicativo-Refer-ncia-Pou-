import { DEFAULT_TIMEZONE } from '@pulso/contracts';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: DEFAULT_TIMEZONE,
});

/** Data e hora no padrão brasileiro, no fuso das unidades (ex.: 16/10/2026, 17:30:12). */
export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

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

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: DEFAULT_TIMEZONE,
});
const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: DEFAULT_TIMEZONE,
});
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeStyle: 'short',
  timeZone: DEFAULT_TIMEZONE,
});
const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: DEFAULT_TIMEZONE,
});

const toDate = (value: string | number | Date) => (value instanceof Date ? value : new Date(value));

/** Data curta (16/10/2026). Datas AAAA-MM-DD são tratadas como data local, sem fuso. */
export function formatDate(value: string | number | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

/** "sexta-feira, 17 de outubro" */
export function formatLongDate(value: string | number | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    value = new Date(`${value}T12:00:00-03:00`);
  }
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '—' : longDateFormatter.format(date);
}

/** Hora (09:30) no fuso das unidades. */
export function formatTime(value: string | number | Date): string {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '—' : timeFormatter.format(date);
}

/** Data local AAAA-MM-DD (fuso das unidades) de um instante. */
export function toIsoDate(value: string | number | Date): string {
  return isoDateFormatter.format(toDate(value));
}

/** Hoje (AAAA-MM-DD) no fuso das unidades. */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Soma dias a uma data AAAA-MM-DD. */
export function addDaysIso(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

/** Idade completa em anos para uma data de nascimento AAAA-MM-DD. */
export function ageFromBirthDate(birthDate: string, today = todayIso()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/** Número com separador de milhar pt-BR. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('pt-BR', options).format(value);
}

/** Primeiro nome, para saudações. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

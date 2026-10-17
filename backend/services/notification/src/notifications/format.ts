import { DEFAULT_TIMEZONE } from '@pulso/contracts';

const DAY_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: DEFAULT_TIMEZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: DEFAULT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Hora local da unidade, ex.: "09:30". */
export function formatTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso));
}

/** Dia e hora locais, ex.: "sex., 17/10 às 09:30". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${DAY_FORMAT.format(date)} às ${TIME_FORMAT.format(date)}`;
}

/** Corta o texto no limite, com reticências, sem quebrar o último caractere. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max
    ? text
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

/** Primeiro nome, para uma saudação curta. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export function bags(quantity: number): string {
  return `${quantity} ${quantity === 1 ? 'bolsa' : 'bolsas'}`;
}

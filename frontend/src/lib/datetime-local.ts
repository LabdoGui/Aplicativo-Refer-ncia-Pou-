/**
 * Conversão entre <input type="datetime-local"> (hora local das unidades) e ISO.
 * As unidades ficam em America/Sao_Paulo, que não tem horário de verão desde
 * 2019 (UTC−3 o ano todo).
 */
const SAO_PAULO_OFFSET = '-03:00';

/** "2026-10-19T14:30" → "2026-10-19T14:30:00-03:00" */
export function localInputToIso(value: string): string {
  return `${value}:00${SAO_PAULO_OFFSET}`;
}

/** Instante → valor de datetime-local no fuso das unidades. */
export function isoToLocalInput(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const shifted = new Date(date.getTime() - 3 * 3_600_000);
  return shifted.toISOString().slice(0, 16);
}

/** Início e fim de um dia local (AAAA-MM-DD) em ISO, para filtros por período. */
export function localDayBoundsIso(date: string): { start: string; end: string } {
  return {
    start: `${date}T00:00:00${SAO_PAULO_OFFSET}`,
    end: `${date}T23:59:59${SAO_PAULO_OFFSET}`,
  };
}

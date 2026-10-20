/**
 * Utilitários equivalentes aos de @pulso/common (sem dependências de Node/Nest),
 * para os módulos da demonstração seguirem as mesmas regras do back-end.
 */
import type { AuthUser, Paginated, StatsFilters } from '@pulso/contracts';
import { localDayRange } from '@backend/libs/common/src/util/dates';
import { fail } from './http';

export {
  addDays,
  ageOn,
  eachLocalDay,
  localDayRange,
  toLocalDate,
  todayLocal,
} from '@backend/libs/common/src/util/dates';

/** Identificador aleatório (UUID v4), também fora de contexto seguro (http na rede local). */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Código legível e aleatório, ex.: humanCode('AG') → "AG-7K3M9P" (igual ao back-end). */
export function humanCode(prefix: string, length = 6): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  let code = '';
  for (const value of values) code += ALPHABET[value % ALPHABET.length];
  return `${prefix}-${code}`;
}

/** Instante atual em ISO (todas as datas do estado são strings ISO). */
export const nowIso = () => new Date().toISOString();

export function pageParams(query: URLSearchParams, defaultSize = 20) {
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(query.get('pageSize') ?? defaultSize) || defaultSize),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginate<T>(items: T[], query: URLSearchParams, defaultSize = 20): Paginated<T> {
  const { page, pageSize, skip } = pageParams(query, defaultSize);
  return { items: items.slice(skip, skip + pageSize), total: items.length, page, pageSize };
}

/** Garante que o usuário da equipe atende a unidade (escopo por unidade). */
export function assertUnitScope(user: AuthUser, unitId: string): void {
  if (user.role === 'ADMIN') return;
  if (!user.unitIds.includes(unitId)) {
    fail(403, 'UNIT_SCOPE', 'Você não está vinculado a esta unidade. Fale com a administração.');
  }
}

export const MAX_STATS_RANGE_DAYS = 400;

/** Converte os filtros de estatística em intervalo UTC, validando ordem e tamanho. */
export function statsRange(query: StatsFilters): { start: Date; end: Date } {
  let range: { start: Date; end: Date };
  try {
    range = localDayRange(query.from, query.to);
  } catch {
    fail(400, 'INVALID_PERIOD', 'Informe datas válidas no formato AAAA-MM-DD.');
  }
  if (range.start > range.end)
    fail(400, 'INVALID_PERIOD', 'A data inicial deve ser anterior à final.');
  const days = (range.end.getTime() - range.start.getTime()) / 86_400_000;
  if (days > MAX_STATS_RANGE_DAYS) {
    fail(400, 'INVALID_PERIOD', `O período pode ter no máximo ${MAX_STATS_RANGE_DAYS} dias.`);
  }
  return range;
}

/** Lê os filtros de estatística da query (from/to obrigatórios, unitId/bloodType opcionais). */
export function statsFilters(query: URLSearchParams): StatsFilters {
  const from = query.get('from');
  const to = query.get('to');
  if (!from || !to) fail(400, 'INVALID_PERIOD', 'Informe o período (from e to).');
  return {
    from,
    to,
    unitId: query.get('unitId') ?? undefined,
    bloodType: (query.get('bloodType') ?? undefined) as StatsFilters['bloodType'],
  };
}

export const inRange = (iso: string, range: { start: Date; end: Date }) => {
  const time = Date.parse(iso);
  return time >= range.start.getTime() && time <= range.end.getTime();
};

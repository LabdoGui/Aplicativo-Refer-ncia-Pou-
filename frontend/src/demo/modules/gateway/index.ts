/**
 * Rotas do próprio gateway (backend/gateway/src): indicadores do dashboard,
 * números públicos da página inicial, trilha de auditoria unificada e saúde.
 * As composições chamam as rotas /internal dos serviços por `internal.*`.
 */
import {
  BLOOD_TYPES,
  SERVICE_NAMES,
  SERVICES,
  type AuditLogEntry,
  type AuditLogsResponse,
  type BloodType,
  type ClinicalStats,
  type DashboardStatistics,
  type EngagementStats,
  type HealthCheckResult,
  type IdentityStats,
  type InventoryStats,
  type PublicStats,
  type SchedulingStats,
  type ServiceName,
  type StatsFilters,
} from '@pulso/contracts';
import { DemoResponse, fail, route, type DemoRequest, type FieldIssue } from '../../core/http';
import { internal } from '../../core/internal';
import { db } from '../../core/state';
import { addDays, nowIso, statsRange, todayLocal } from '../../core/support';

const VERSION = '0.1.0';

/** Serviços com trilha de auditoria (o notification não guarda ações de pessoas). */
const AUDITED_SERVICES = [
  'identity',
  'scheduling',
  'clinical',
  'inventory',
  'engagement',
] as const satisfies readonly ServiceName[];
const AUDIT_LOGS_DEFAULT_LIMIT = 100;
const AUDIT_LOGS_MAX_LIMIT = 500;

/** Por quanto tempo os números públicos da página inicial são reaproveitados. */
const PUBLIC_STATS_TTL_MS = 60_000;
/** Janela dos números públicos ("doações nos últimos 30 dias"). */
const PUBLIC_STATS_DAYS = 30;

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Formatos ISO 8601 aceitos pelo @IsISO8601() (data, ou data e hora com fuso opcional). */
const ISO_8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)?)?$/;

function validationFail(errors: FieldIssue[]): never {
  return fail(
    400,
    'VALIDATION_ERROR',
    'Alguns campos precisam de correção.',
    'Dados inválidos',
    errors,
  );
}

/** Campos fora do DTO são recusados (ValidationPipe com forbidNonWhitelisted). */
function unknownParams(query: URLSearchParams, allowed: readonly string[], errors: FieldIssue[]) {
  for (const key of new Set(query.keys())) {
    if (!allowed.includes(key)) errors.push({ field: key, message: 'Campo não permitido.' });
  }
}

// --- Composição (InternalSources + DashboardService) -------------------------

type SourceResult<T> =
  | { service: ServiceName; ok: true; value: T }
  | { service: ServiceName; ok: false; reason: string };

/** Nunca lança: serviço fora do ar ou com erro vira `ok: false` e o painel degrada. */
function source<T>(service: ServiceName, call: () => T): SourceResult<T> {
  try {
    const value = call();
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { service, ok: true, value }
      : { service, ok: false, reason: 'INVALID_RESPONSE' };
  } catch (error) {
    // Módulo ainda não registrado ou com falha: como um serviço fora do ar (o gateway real
    // registra um aviso com o motivo, sem stack trace).
    const reason = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
    console.warn(`[demo] gateway: ${service} indisponível na composição (${reason})`);
    return { service, ok: false, reason };
  }
}

const valueOf = <T>(result: SourceResult<T>): T | null => (result.ok ? result.value : null);

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** DashboardQueryDto: from/to AAAA-MM-DD, unidade (UUID) e tipo sanguíneo opcionais. */
function dashboardFilters(query: URLSearchParams): StatsFilters {
  const errors: FieldIssue[] = [];
  unknownParams(query, ['from', 'to', 'unitId', 'bloodType'], errors);
  const from = query.get('from') ?? '';
  const to = query.get('to') ?? '';
  const unitId = query.get('unitId');
  const bloodType = query.get('bloodType');
  if (!LOCAL_DATE.test(from)) {
    errors.push({ field: 'from', message: 'Informe a data no formato AAAA-MM-DD.' });
  }
  if (!LOCAL_DATE.test(to)) {
    errors.push({ field: 'to', message: 'Informe a data no formato AAAA-MM-DD.' });
  }
  if (unitId !== null && !UUID.test(unitId)) {
    errors.push({ field: 'unitId', message: 'Identificador inválido.' });
  }
  if (bloodType !== null && !(BLOOD_TYPES as readonly string[]).includes(bloodType)) {
    errors.push({ field: 'bloodType', message: 'Valor não permitido.' });
  }
  if (errors.length > 0) validationFail(errors);
  return {
    from,
    to,
    ...(unitId ? { unitId } : {}),
    ...(bloodType ? { bloodType: bloodType as BloodType } : {}),
  };
}

function statistics(request: DemoRequest): DashboardStatistics {
  const filters = dashboardFilters(request.query);
  // Valida ordem e tamanho do período antes de consultar os serviços.
  statsRange(filters);
  const { from, to, unitId, bloodType } = filters;

  const identity = source<IdentityStats>('identity', () => internal.identity.stats({ from, to }));
  const scheduling = source<SchedulingStats>('scheduling', () =>
    internal.scheduling.stats({ from, to, unitId }),
  );
  const clinical = source<ClinicalStats>('clinical', () =>
    internal.clinical.stats({ from, to, unitId, bloodType }),
  );
  const inventory = source<InventoryStats>('inventory', () =>
    internal.inventory.stats({ from, to, bloodType }),
  );
  const engagement = source<EngagementStats>('engagement', () =>
    internal.engagement.stats({ from, to }),
  );
  const results = [identity, scheduling, clinical, inventory, engagement];

  return {
    filters: {
      from,
      to,
      ...(unitId ? { unitId } : {}),
      ...(bloodType ? { bloodType } : {}),
    },
    generatedAt: nowIso(),
    identity: valueOf(identity),
    scheduling: valueOf(scheduling),
    clinical: valueOf(clinical),
    inventory: valueOf(inventory),
    engagement: valueOf(engagement),
    unavailable: results.filter((result) => !result.ok).map((result) => result.service),
  };
}

let publicCache: { value: PublicStats; expiresAt: number } | undefined;

/** Números agregados da página inicial (sem dados pessoais e sem quantidades de estoque). */
function publicStats(): PublicStats {
  if (publicCache && publicCache.expiresAt > Date.now()) return publicCache.value;
  const to = todayLocal();
  const from = addDays(to, -(PUBLIC_STATS_DAYS - 1));
  const clinical = source<ClinicalStats>('clinical', () => internal.clinical.stats({ from, to }));
  const scheduling = source<SchedulingStats>('scheduling', () =>
    internal.scheduling.stats({ from, to }),
  );
  const identity = source<IdentityStats>('identity', () => internal.identity.stats({ from, to }));
  const inventory = source<InventoryStats>('inventory', () =>
    internal.inventory.stats({ from, to }),
  );

  const levels =
    inventory.ok && Array.isArray(inventory.value.levels) ? inventory.value.levels : [];
  const value: PublicStats = {
    donationsLast30Days: numberOrNull(valueOf(clinical)?.donationsCompleted),
    activeUnits: numberOrNull(valueOf(scheduling)?.activeUnits),
    donorsRegistered: numberOrNull(valueOf(identity)?.donorsTotal),
    // Só o status de cada tipo: as quantidades ficam restritas à administração.
    stock: levels.map(({ bloodType, status }) => ({ bloodType, status })),
    generatedAt: nowIso(),
  };
  publicCache = { value, expiresAt: Date.now() + PUBLIC_STATS_TTL_MS };
  return value;
}

// --- Auditoria (AuditLogsService) ---------------------------------------------

/** Mais recentes primeiro; empate decidido pelo id, para a ordem ser estável. */
function compareByNewest(a: AuditLogEntry, b: AuditLogEntry): number {
  const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

function auditLogs(request: DemoRequest): AuditLogsResponse {
  const { query } = request;
  const errors: FieldIssue[] = [];
  unknownParams(query, ['service', 'from', 'to', 'action', 'limit'], errors);
  const service = query.get('service');
  const from = query.get('from');
  const to = query.get('to');
  const action = query.get('action');
  const rawLimit = query.get('limit');
  if (service !== null && !(AUDITED_SERVICES as readonly string[]).includes(service)) {
    errors.push({ field: 'service', message: 'Valor não permitido.' });
  }
  for (const [field, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (value !== null && (!ISO_8601.test(value) || Number.isNaN(Date.parse(value)))) {
      errors.push({ field, message: 'Informe uma data válida.' });
    }
  }
  if (action !== null && action.length > 80) {
    errors.push({ field: 'action', message: 'Deve ter no máximo 80 caracteres.' });
  }
  let limit = AUDIT_LOGS_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!(limit <= AUDIT_LOGS_MAX_LIMIT)) {
      errors.push({
        field: 'limit',
        message: `Deve ser menor ou igual a ${AUDIT_LOGS_MAX_LIMIT}.`,
      });
    }
    if (!(limit >= 1)) errors.push({ field: 'limit', message: 'Deve ser maior ou igual a 1.' });
    if (!Number.isInteger(limit)) {
      errors.push({ field: 'limit', message: 'Deve ser um número inteiro.' });
    }
  }
  if (errors.length > 0) validationFail(errors);

  // Cada serviço filtra a própria trilha (from/to/prefixo da ação) e o gateway junta tudo.
  const services: readonly string[] = service ? [service] : AUDITED_SERVICES;
  const start = from ? Date.parse(from) : -Infinity;
  const end = to ? Date.parse(to) : Infinity;
  const items = db()
    .audit.filter((entry) => {
      if (!services.includes(entry.service)) return false;
      const time = Date.parse(entry.createdAt);
      if (time < start || time > end) return false;
      return !action || entry.action.startsWith(action);
    })
    .sort(compareByNewest)
    .slice(0, limit)
    .map((entry) => ({ ...entry }));
  return { items, unavailable: [] };
}

// --- Saúde (ServicesHealthController) ------------------------------------------

const startedAt = Date.now();

function liveness(): HealthCheckResult {
  return {
    status: 'up',
    service: 'gateway',
    version: VERSION,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    checks: {},
  };
}

/** Todos os serviços "no ar", com banco e broker (tudo roda dentro da página). */
function servicesHealth() {
  const services = SERVICE_NAMES.map((name) => ({
    name,
    title: SERVICES[name].title,
    status: 'up' as const,
    version: VERSION,
    checks: { database: 'up' as const, broker: 'up' as const },
    latencyMs: 5 + Math.floor(Math.random() * 20),
  }));
  return { status: 'up' as const, checkedAt: nowIso(), services };
}

export function registerGateway(): void {
  route('GET', '/dashboard/statistics', statistics, { permissions: ['analytics:read'] });
  route(
    'GET',
    '/dashboard/public-stats',
    () => new DemoResponse(publicStats(), 200, { 'cache-control': 'public, max-age=60' }),
    { auth: 'public' },
  );
  route('GET', '/audit-logs', auditLogs, { permissions: ['audit:read'] });
  route('GET', '/health', liveness, { auth: 'public' });
  route('GET', '/health/services', servicesHealth, { auth: 'public' });
}

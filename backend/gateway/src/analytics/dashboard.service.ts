import { Injectable, Logger } from '@nestjs/common';
import { addDays, statsRange, todayLocal } from '@pulso/common';
import type {
  ClinicalStats,
  DashboardStatistics,
  EngagementStats,
  IdentityStats,
  InventoryStats,
  PublicStats,
  SchedulingStats,
  StatsFilters,
} from '@pulso/contracts';
import { InternalSources, isObject, STATS_PATH, type SourceResult } from './internal-sources';

/** Por quanto tempo os números públicos da página inicial são reaproveitados. */
export const PUBLIC_STATS_TTL_MS = 60_000;
/** Janela dos números públicos ("doações nos últimos 30 dias"). */
export const PUBLIC_STATS_DAYS = 30;

/** Resposta de /internal/stats: um objeto (a forma de cada serviço vem de @pulso/contracts). */
const isStats = <T>(body: unknown): body is T => isObject(body);

function valueOf<T>(result: SourceResult<T>): T | null {
  return result.ok ? result.value : null;
}

/**
 * Composição de estatísticas para o dashboard administrativo e a página
 * inicial. Cada serviço responde pela sua parte; se um falhar, o restante
 * continua disponível (degradação parcial) e o painel informa o que faltou.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private publicCache?: { value: PublicStats; expiresAt: number };
  private publicInFlight?: Promise<PublicStats>;

  constructor(private readonly sources: InternalSources) {}

  async statistics(filters: StatsFilters, requestId?: string): Promise<DashboardStatistics> {
    // Valida ordem e tamanho do período antes de consultar os serviços.
    statsRange(filters);
    const { from, to, unitId, bloodType } = filters;

    const [identity, scheduling, clinical, inventory, engagement] = await Promise.all([
      this.stats<IdentityStats>('identity', { from, to }, requestId),
      this.stats<SchedulingStats>('scheduling', { from, to, unitId }, requestId),
      this.stats<ClinicalStats>('clinical', { from, to, unitId, bloodType }, requestId),
      this.stats<InventoryStats>('inventory', { from, to, bloodType }, requestId),
      this.stats<EngagementStats>('engagement', { from, to }, requestId),
    ]);
    const results = [identity, scheduling, clinical, inventory, engagement];
    this.warnPartial(results, 'Estatísticas do dashboard incompletas', requestId);

    return {
      filters: {
        from,
        to,
        ...(unitId ? { unitId } : {}),
        ...(bloodType ? { bloodType } : {}),
      },
      generatedAt: new Date().toISOString(),
      identity: valueOf(identity),
      scheduling: valueOf(scheduling),
      clinical: valueOf(clinical),
      inventory: valueOf(inventory),
      engagement: valueOf(engagement),
      unavailable: results.filter((result) => !result.ok).map((result) => result.service),
    };
  }

  /**
   * Números agregados da página inicial (sem dados pessoais e sem quantidades
   * de estoque). Guardados por 60 s e montados uma vez por vez, para a rota
   * pública não servir de amplificador de carga sobre os serviços.
   */
  async publicStats(requestId?: string): Promise<PublicStats> {
    if (this.publicCache && this.publicCache.expiresAt > this.now()) {
      return this.publicCache.value;
    }
    this.publicInFlight ??= this.buildPublicStats(requestId).finally(() => {
      this.publicInFlight = undefined;
    });
    return this.publicInFlight;
  }

  /** Relógio (substituível nos testes). */
  protected now(): number {
    return Date.now();
  }

  private async buildPublicStats(requestId?: string): Promise<PublicStats> {
    const to = todayLocal();
    const from = addDays(to, -(PUBLIC_STATS_DAYS - 1));
    const [clinical, scheduling, identity, inventory] = await Promise.all([
      this.stats<ClinicalStats>('clinical', { from, to }, requestId),
      this.stats<SchedulingStats>('scheduling', { from, to }, requestId),
      this.stats<IdentityStats>('identity', { from, to }, requestId),
      this.stats<InventoryStats>('inventory', { from, to }, requestId),
    ]);
    this.warnPartial(
      [clinical, scheduling, identity, inventory],
      'Estatísticas públicas incompletas',
      requestId,
    );

    const levels =
      inventory.ok && Array.isArray(inventory.value.levels) ? inventory.value.levels : [];
    const value: PublicStats = {
      donationsLast30Days: numberOrNull(valueOf(clinical)?.donationsCompleted),
      activeUnits: numberOrNull(valueOf(scheduling)?.activeUnits),
      donorsRegistered: numberOrNull(valueOf(identity)?.donorsTotal),
      // Só o status de cada tipo: as quantidades ficam restritas à administração.
      stock: levels.map(({ bloodType, status }) => ({ bloodType, status })),
      generatedAt: new Date().toISOString(),
    };
    this.publicCache = { value, expiresAt: this.now() + PUBLIC_STATS_TTL_MS };
    return value;
  }

  private stats<T>(
    service: SourceResult<T>['service'],
    query: Record<string, string | undefined>,
    requestId?: string,
  ): Promise<SourceResult<T>> {
    return this.sources.get<T>(service, STATS_PATH, query, isStats<T>, requestId);
  }

  /** Um aviso por consulta, com os serviços que faltaram e o motivo (sem stack trace). */
  private warnPartial(results: SourceResult<unknown>[], message: string, requestId?: string): void {
    const failures = results.filter((result) => !result.ok);
    if (failures.length === 0) return;
    this.logger.warn(
      {
        requestId,
        unavailable: Object.fromEntries(
          failures.map((failure) => [failure.service, failure.ok ? '' : failure.reason]),
        ),
      },
      message,
    );
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

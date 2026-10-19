import { Logger } from '@nestjs/common';
import { AppException, addDays, todayLocal } from '@pulso/common';
import type { ServiceName } from '@pulso/contracts';
import { DashboardService, PUBLIC_STATS_TTL_MS } from './dashboard.service';
import type { InternalSources, SourceResult } from './internal-sources';

const STATS: Partial<Record<ServiceName, Record<string, unknown>>> = {
  identity: { donorsTotal: 75, donorsNewInPeriod: 2, newDonorsByDay: [], staffTotal: 4 },
  scheduling: { appointmentsTotal: 10, activeUnits: 3 },
  clinical: { donationsCompleted: 12, donationsNotCompleted: 1 },
  inventory: {
    totalBags: 600,
    levels: [
      { bloodType: 'O_NEG', quantity: 31, status: 'CRITICAL' },
      { bloodType: 'A_POS', quantity: 182, status: 'NORMAL' },
    ],
  },
  engagement: { pointsAwarded: 1500 },
};

class TestDashboardService extends DashboardService {
  clock = 1_000_000;
  protected override now(): number {
    return this.clock;
  }
}

describe('DashboardService', () => {
  let down: Set<ServiceName>;
  let get: jest.Mock;
  let service: TestDashboardService;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    down = new Set();
    get = jest.fn(async (name: ServiceName): Promise<SourceResult<unknown>> =>
      down.has(name)
        ? { service: name, ok: false, reason: 'UPSTREAM_UNAVAILABLE' }
        : { service: name, ok: true, value: STATS[name] },
    );
    service = new TestDashboardService({ get } as unknown as InternalSources);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('statistics', () => {
    const filters = { from: '2026-09-17', to: '2026-10-17' };

    it('reúne as estatísticas dos 5 serviços e repete os filtros', async () => {
      const result = await service.statistics({ ...filters, unitId: undefined }, 'req-1');

      expect(result.filters).toEqual(filters);
      expect(result.identity).toEqual(STATS.identity);
      expect(result.engagement).toEqual(STATS.engagement);
      expect(result.unavailable).toEqual([]);
      expect(Date.parse(result.generatedAt)).not.toBeNaN();
      expect(warn).not.toHaveBeenCalled();
    });

    it('repassa a cada serviço só os filtros que ele entende', async () => {
      const unitId = '3c9911a0-c648-4537-a512-c12172bc808a';
      await service.statistics({ ...filters, unitId, bloodType: 'O_NEG' });
      const queries = Object.fromEntries(get.mock.calls.map(([name, , query]) => [name, query]));

      expect(queries.identity).toEqual(filters);
      expect(queries.scheduling).toEqual({ ...filters, unitId });
      expect(queries.clinical).toEqual({ ...filters, unitId, bloodType: 'O_NEG' });
      expect(queries.inventory).toEqual({ ...filters, bloodType: 'O_NEG' });
      expect(queries.engagement).toEqual(filters);
    });

    it('degrada parcialmente: serviço fora do ar vira null e entra em unavailable', async () => {
      down = new Set(['clinical', 'engagement']);
      const result = await service.statistics(filters);

      expect(result.clinical).toBeNull();
      expect(result.engagement).toBeNull();
      expect(result.identity).toEqual(STATS.identity);
      expect(result.unavailable).toEqual(['clinical', 'engagement']);
      // Um único aviso por consulta, com o motivo de cada falha.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatchObject({
        unavailable: { clinical: 'UPSTREAM_UNAVAILABLE', engagement: 'UPSTREAM_UNAVAILABLE' },
      });
    });

    it('recusa período invertido sem consultar os serviços', async () => {
      await expect(
        service.statistics({ from: '2026-10-17', to: '2026-10-01' }),
      ).rejects.toBeInstanceOf(AppException);
      expect(get).not.toHaveBeenCalled();
    });
  });

  describe('publicStats', () => {
    it('mostra só o status do estoque (sem quantidades) e os totais agregados', async () => {
      const result = await service.publicStats();

      expect(result).toMatchObject({
        donationsLast30Days: 12,
        activeUnits: 3,
        donorsRegistered: 75,
      });
      expect(result.stock).toEqual([
        { bloodType: 'O_NEG', status: 'CRITICAL' },
        { bloodType: 'A_POS', status: 'NORMAL' },
      ]);
      expect(JSON.stringify(result)).not.toContain('quantity');
    });

    it('consulta os últimos 30 dias (datas locais, inclusivas)', async () => {
      await service.publicStats();
      const today = todayLocal();
      for (const [, , query] of get.mock.calls) {
        expect(query).toEqual({ from: addDays(today, -29), to: today });
      }
      expect(get.mock.calls.map(([name]) => name).sort()).toEqual([
        'clinical',
        'identity',
        'inventory',
        'scheduling',
      ]);
    });

    it('usa null/[] quando os serviços não respondem', async () => {
      down = new Set(['clinical', 'scheduling', 'identity', 'inventory']);
      await expect(service.publicStats()).resolves.toMatchObject({
        donationsLast30Days: null,
        activeUnits: null,
        donorsRegistered: null,
        stock: [],
      });
    });

    it('guarda o resultado por 60 s e monta uma vez para chamadas simultâneas', async () => {
      await Promise.all([service.publicStats(), service.publicStats(), service.publicStats()]);
      expect(get).toHaveBeenCalledTimes(4);

      service.clock += PUBLIC_STATS_TTL_MS - 1;
      await service.publicStats();
      expect(get).toHaveBeenCalledTimes(4);

      service.clock += 2;
      await service.publicStats();
      expect(get).toHaveBeenCalledTimes(8);
    });
  });
});

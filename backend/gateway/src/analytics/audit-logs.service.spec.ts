import { Logger } from '@nestjs/common';
import type { AuditLogEntry, ServiceName } from '@pulso/contracts';
import { AUDIT_LOGS_DEFAULT_LIMIT, AUDITED_SERVICES } from './analytics.dto';
import { AuditLogsService, compareByNewest } from './audit-logs.service';
import { AUDIT_LOGS_PATH, type InternalSources, type SourceResult } from './internal-sources';

function entry(id: string, createdAt: string, service = 'identity-service'): AuditLogEntry {
  return {
    id,
    service,
    actorId: null,
    actorRole: 'ADMIN',
    action: 'stock.movement_created',
    entity: 'stock',
    entityId: null,
    metadata: null,
    requestId: null,
    createdAt,
  };
}

describe('AuditLogsService', () => {
  let responses: Partial<Record<ServiceName, unknown[] | null>>;
  let get: jest.Mock;
  let service: AuditLogsService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    responses = {
      identity: [entry('i1', '2026-10-17T10:00:00.000Z'), entry('i2', '2026-10-15T10:00:00.000Z')],
      scheduling: [entry('s1', '2026-10-16T10:00:00.000Z', 'scheduling-service')],
      clinical: [],
      inventory: [entry('v1', '2026-10-17T12:00:00.000Z', 'inventory-service')],
      engagement: null,
    };
    get = jest.fn(async (name: ServiceName): Promise<SourceResult<unknown[]>> => {
      const body = responses[name];
      return body
        ? { service: name, ok: true, value: body }
        : { service: name, ok: false, reason: 'NOT_FOUND' };
    });
    service = new AuditLogsService({ get } as unknown as InternalSources);
  });

  afterEach(() => jest.restoreAllMocks());

  it('junta as trilhas, das mais recentes para as mais antigas, e lista quem faltou', async () => {
    const result = await service.list({});

    expect(result.items.map((item) => item.id)).toEqual(['v1', 'i1', 's1', 'i2']);
    expect(result.unavailable).toEqual(['engagement']);
  });

  it('identifica o serviço pelo nome do gateway (o mesmo do filtro)', async () => {
    const result = await service.list({});
    expect(result.items.find((item) => item.id === 'v1')?.service).toBe('inventory');
  });

  it('consulta os 5 serviços auditados e repassa filtros e limite padrão', async () => {
    await service.list({ from: '2026-10-01T00:00:00Z', action: 'auth.' });

    expect(get.mock.calls.map(([name]) => name)).toEqual([...AUDITED_SERVICES]);
    expect(get).toHaveBeenCalledWith(
      'identity',
      AUDIT_LOGS_PATH,
      {
        from: '2026-10-01T00:00:00Z',
        to: undefined,
        action: 'auth.',
        limit: AUDIT_LOGS_DEFAULT_LIMIT,
      },
      expect.any(Function),
      undefined,
    );
  });

  it('com `service`, consulta só esse serviço', async () => {
    await service.list({ service: 'inventory' });
    expect(get.mock.calls.map(([name]) => name)).toEqual(['inventory']);
  });

  it('corta no limite depois de ordenar', async () => {
    const result = await service.list({ limit: 2 });
    expect(result.items.map((item) => item.id)).toEqual(['v1', 'i1']);
  });

  it('descarta registros malformados', async () => {
    responses.identity = [
      entry('ok', '2026-10-17T10:00:00.000Z'),
      { id: 'x' },
      'lixo',
      entry('sem-data', 'ontem'),
    ];
    const result = await service.list({ service: 'identity' });
    expect(result.items.map((item) => item.id)).toEqual(['ok']);
  });

  it('desempata pelo id para a ordem ser estável', () => {
    const same = '2026-10-17T10:00:00.000Z';
    expect([entry('b', same), entry('a', same)].sort(compareByNewest).map((e) => e.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

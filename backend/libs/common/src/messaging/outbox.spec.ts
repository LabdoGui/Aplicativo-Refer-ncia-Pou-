import { Logger } from '@nestjs/common';
import { EVENTS, type EventEnvelope } from '@pulso/contracts';
import type { BrokerConnection, EventPublisher } from './broker';
import { OUTBOX_BATCH_SIZE, OutboxRelay, OutboxService } from './outbox';

function envelope(id: string): EventEnvelope {
  return {
    id,
    type: EVENTS.USER_REGISTERED,
    source: 'identity-service',
    occurredAt: '2026-10-17T12:00:00.000Z',
    data: { userId: 'u1', name: 'Teste', role: 'DONOR' },
  };
}

describe('OutboxRelay', () => {
  let rows: Array<{
    id: string;
    payload: EventEnvelope;
    publishedAt: Date | null;
    lastError?: string;
  }>;
  let prisma: { $queryRawUnsafe: jest.Mock; $executeRawUnsafe: jest.Mock };
  let publish: jest.Mock;
  let ready: boolean;
  let relay: OutboxRelay;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    rows = [];
    ready = true;
    prisma = {
      $queryRawUnsafe: jest.fn(async () =>
        rows.filter((row) => !row.publishedAt).slice(0, OUTBOX_BATCH_SIZE),
      ),
      $executeRawUnsafe: jest.fn(async (sql: string, id: string, error?: string) => {
        const row = rows.find((r) => r.id === id);
        if (row && sql.includes('"publishedAt" = now()')) row.publishedAt = new Date();
        if (row && error) row.lastError = error;
        return 1;
      }),
    };
    publish = jest.fn(async () => undefined);
    relay = new OutboxRelay(
      prisma as never,
      { isReady: () => ready } as unknown as BrokerConnection,
      { publish } as unknown as EventPublisher,
    );
  });

  it('publica os pendentes em ordem e marca como publicados', async () => {
    rows.push({ id: 'a', payload: envelope('a'), publishedAt: null });
    rows.push({ id: 'b', payload: envelope('b'), publishedAt: null });
    await relay.flush();
    expect(publish.mock.calls.map(([e]) => e.id)).toEqual(['a', 'b']);
    expect(rows.every((row) => row.publishedAt)).toBe(true);
  });

  it('para no primeiro erro, registra a falha e mantém o evento pendente', async () => {
    rows.push({ id: 'a', payload: envelope('a'), publishedAt: null });
    rows.push({ id: 'b', payload: envelope('b'), publishedAt: null });
    publish.mockRejectedValueOnce(new Error('broker fora'));
    await relay.flush();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(rows[0].publishedAt).toBeNull();
    expect(rows[0].lastError).toBe('broker fora');
    expect(rows[1].publishedAt).toBeNull();
  });

  it('não lê o outbox com o broker indisponível', async () => {
    ready = false;
    rows.push({ id: 'a', payload: envelope('a'), publishedAt: null });
    await relay.flush();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('junta execuções concorrentes em uma só', async () => {
    rows.push({ id: 'a', payload: envelope('a'), publishedAt: null });
    await Promise.all([relay.flush(), relay.flush(), relay.flush()]);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('percorre vários lotes até esvaziar', async () => {
    for (let i = 0; i < OUTBOX_BATCH_SIZE + 3; i++) {
      rows.push({ id: `e${i}`, payload: envelope(`e${i}`), publishedAt: null });
    }
    await relay.flush();
    expect(publish).toHaveBeenCalledTimes(OUTBOX_BATCH_SIZE + 3);
  });
});

describe('OutboxService', () => {
  it('grava o envelope com o cliente da transação e agenda a publicação', async () => {
    const tx = { $executeRawUnsafe: jest.fn(async () => 1), $queryRawUnsafe: jest.fn() };
    const kick = jest.fn();
    const publisher = {
      createEnvelope: jest.fn((type, data) => ({ ...envelope('x'), type, data })),
    };
    const service = new OutboxService(publisher as never, { kick } as never);
    const result = await service.enqueue(tx, EVENTS.USER_REGISTERED, {
      userId: 'u1',
      name: 'Teste',
      role: 'DONOR',
    });
    expect(result.id).toBe('x');
    const [sql, id, type, payload] = tx.$executeRawUnsafe.mock.calls[0] as unknown as [
      string,
      string,
      string,
      string,
    ];
    expect(sql).toContain('INSERT INTO "outbox_events"');
    expect(id).toBe('x');
    expect(type).toBe(EVENTS.USER_REGISTERED);
    expect(JSON.parse(payload).data.userId).toBe('u1');
    expect(kick).toHaveBeenCalled();
  });
});

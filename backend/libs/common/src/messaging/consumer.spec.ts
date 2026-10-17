import { Logger } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { EVENTS, type EventEnvelope } from '@pulso/contracts';
import type { BrokerConnection } from './broker';
import { ATTEMPT_HEADER, CONSUMER_MAX_ATTEMPTS, EventConsumer, queueNames } from './consumer';

const EVENT_ID = '0b9d7a3e-5f7c-4b1a-9e2d-1c3f5a7b9d11';

function message(body: unknown, attempt?: number): ConsumeMessage {
  return {
    content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
    fields: { routingKey: EVENTS.USER_REGISTERED } as ConsumeMessage['fields'],
    properties: {
      headers: attempt ? { [ATTEMPT_HEADER]: attempt } : {},
      contentType: 'application/json',
    } as ConsumeMessage['properties'],
  };
}

const envelope: EventEnvelope<'identity.user.registered'> = {
  id: EVENT_ID,
  type: EVENTS.USER_REGISTERED,
  source: 'identity-service',
  occurredAt: '2026-10-17T12:00:00.000Z',
  data: { userId: 'u1', name: 'Teste', role: 'DONOR' },
};

describe('EventConsumer', () => {
  let processed: Set<string>;
  let prisma: { $transaction: jest.Mock };
  let channel: { ack: jest.Mock; nack: jest.Mock; sendToQueue: jest.Mock };
  let consumer: EventConsumer;
  const queues = queueNames('notification-service');

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    processed = new Set();
    // Transação falsa: a marca de processado só vale se o handler terminar.
    prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const pending: string[] = [];
        const tx = {
          $executeRawUnsafe: jest.fn(async (_sql: string, id: string, handler: string) => {
            const key = `${id}:${handler}`;
            if (processed.has(key) || pending.includes(key)) return 0;
            pending.push(key);
            return 1;
          }),
        };
        const result = await fn(tx);
        pending.forEach((key) => processed.add(key));
        return result;
      }),
    };
    channel = {
      ack: jest.fn(),
      nack: jest.fn(),
      sendToQueue: jest.fn(async () => undefined),
    };
    consumer = new EventConsumer({} as BrokerConnection, prisma as never, 'notification-service');
  });

  /** Simula o bootstrap: os handlers são registrados antes de o canal existir. */
  const attachChannel = () => {
    (consumer as unknown as { channel: unknown }).channel = channel;
  };

  it('executa o handler e confirma a mensagem', async () => {
    const handler = jest.fn(async () => undefined);
    consumer.on(EVENTS.USER_REGISTERED, 'welcome', handler);
    attachChannel();
    await consumer.onMessage(message(envelope));
    expect(handler).toHaveBeenCalledWith(envelope, expect.anything());
    expect(channel.ack).toHaveBeenCalled();
  });

  it('ignora entregas repetidas do mesmo evento (idempotência)', async () => {
    const handler = jest.fn(async () => undefined);
    consumer.on(EVENTS.USER_REGISTERED, 'welcome', handler);
    attachChannel();
    await consumer.onMessage(message(envelope));
    await consumer.onMessage(message(envelope));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledTimes(2);
  });

  it('agenda nova tentativa quando o handler falha', async () => {
    consumer.on(EVENTS.USER_REGISTERED, 'welcome', async () => {
      throw new Error('banco fora');
    });
    attachChannel();
    await consumer.onMessage(message(envelope));
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      queues.retry,
      expect.any(Buffer),
      expect.objectContaining({
        headers: expect.objectContaining({ [ATTEMPT_HEADER]: 2 }),
      }),
    );
    expect(channel.ack).toHaveBeenCalled();
    expect(processed.size).toBe(0);
  });

  it('envia para a DLQ depois da última tentativa', async () => {
    consumer.on(EVENTS.USER_REGISTERED, 'welcome', async () => {
      throw new Error('erro permanente');
    });
    attachChannel();
    await consumer.onMessage(message(envelope, CONSUMER_MAX_ATTEMPTS));
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      queues.dead,
      expect.any(Buffer),
      expect.anything(),
    );
  });

  it('manda mensagens que não são envelopes direto para a DLQ', async () => {
    attachChannel();
    await consumer.onMessage(message('isto não é json'));
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      queues.dead,
      expect.any(Buffer),
      expect.anything(),
    );
    expect(channel.ack).toHaveBeenCalled();
  });

  it('devolve a mensagem se não conseguir reenfileirar', async () => {
    consumer.on(EVENTS.USER_REGISTERED, 'welcome', async () => {
      throw new Error('falha');
    });
    attachChannel();
    channel.sendToQueue.mockRejectedValueOnce(new Error('broker fora'));
    await consumer.onMessage(message(envelope));
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('não aceita handlers com nome repetido para o mesmo evento', () => {
    consumer.on(EVENTS.USER_REGISTERED, 'welcome', async () => undefined);
    expect(() => consumer.on(EVENTS.USER_REGISTERED, 'welcome', async () => undefined)).toThrow();
  });
});

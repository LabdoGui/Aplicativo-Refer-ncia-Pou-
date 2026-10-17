import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { AmqpConnectionManagerClass, connect } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { EVENT_EXCHANGE, EVENTS } from '@pulso/contracts';
import {
  BROKER_PUBLISH_TIMEOUT_MS,
  BrokerConnection,
  BrokerHealthIndicator,
  CONNECT_FAILED_LOG_INTERVAL_MS,
  EventPublisher,
} from './broker';

// O connect() real tentaria abrir conexão; o gerenciador usado nos testes é criado à mão
// (sem conectar) e o ChannelWrapper continua sendo o real da biblioteca.
jest.mock('amqp-connection-manager', () => ({
  ...jest.requireActual('amqp-connection-manager'),
  connect: jest.fn(),
}));

const connectMock = connect as jest.MockedFunction<typeof connect>;

/** Canal do amqplib falso: só o necessário para o setup e para o ChannelWrapper. */
class FakeAmqpChannel extends EventEmitter {
  assertExchange = jest.fn(async () => ({ exchange: EVENT_EXCHANGE }));
  close = jest.fn(async () => undefined);
}

/** Conexão do amqplib falsa, entregue no evento 'connect' do gerenciador. */
function fakeAmqpConnection(channel: FakeAmqpChannel) {
  return { createConfirmChannel: jest.fn(async () => channel as unknown as ConfirmChannel) };
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

describe('BrokerConnection', () => {
  let manager: InstanceType<typeof AmqpConnectionManagerClass>;
  let broker: BrokerConnection;
  let health: BrokerHealthIndicator;
  let connected: boolean;
  let warnLog: jest.SpyInstance;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    manager = new AmqpConnectionManagerClass(['amqp://pulso:segredo@broker-teste:5672']);
    connected = false;
    jest.spyOn(manager, 'isConnected').mockImplementation(() => connected);
    connectMock.mockReturnValue(manager);

    broker = new BrokerConnection({ RABBITMQ_URL: 'amqp://pulso:segredo@broker-teste:5672' });
    health = new BrokerHealthIndicator(broker);
    broker.onModuleInit();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await broker.onApplicationShutdown();
    jest.restoreAllMocks();
  });

  /** Simula o gerenciador conectando e entregando o canal ao ChannelWrapper. */
  async function connectWith(channel: FakeAmqpChannel): Promise<void> {
    connected = true;
    manager.emit('connect', { connection: fakeAmqpConnection(channel), url: 'amqp://teste' });
    await flushPromises();
  }

  it('cria o canal com confirmação e tempo limite de publicação', () => {
    const createChannel = jest.spyOn(AmqpConnectionManagerClass.prototype, 'createChannel');
    const other = new BrokerConnection({ RABBITMQ_URL: 'amqp://teste' });
    other.onModuleInit();

    expect(createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ confirm: true, publishTimeout: BROKER_PUBLISH_TIMEOUT_MS }),
    );
    expect(BROKER_PUBLISH_TIMEOUT_MS).toBe(5_000);
  });

  it('fica pronto (health up) depois de conectar e declarar o exchange', async () => {
    const channel = new FakeAmqpChannel();

    expect(await health.isHealthy()).toBe(false);
    await connectWith(channel);

    expect(channel.assertExchange).toHaveBeenCalledWith(EVENT_EXCHANGE, 'topic', {
      durable: true,
    });
    expect(await health.isHealthy()).toBe(true);
  });

  it('health down quando a conexão cai', async () => {
    await connectWith(new FakeAmqpChannel());

    connected = false;
    manager.emit('disconnect', { err: new Error('connection closed') });

    expect(await health.isHealthy()).toBe(false);
    expect(warnLog).toHaveBeenCalledWith(
      { err: 'connection closed' },
      expect.stringContaining('Desconectado'),
    );
  });

  it('health down quando o broker fecha o canal, mesmo com a conexão ativa', async () => {
    const channel = new FakeAmqpChannel();
    await connectWith(channel);

    // O amqplib emite 'error' e depois 'close' quando o broker fecha o canal.
    expect(() => channel.emit('error', new Error('Channel closed by server: 406'))).not.toThrow();
    channel.emit('close');

    expect(broker.isConnected()).toBe(true);
    expect(await health.isHealthy()).toBe(false);
    expect(errorLog).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      expect.stringContaining('fechado pelo broker'),
    );
  });

  it('erro na configuração do canal é registrado, não derruba o processo e deixa health down', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const channel = new FakeAmqpChannel();
      channel.assertExchange.mockRejectedValueOnce(new Error('PRECONDITION_FAILED'));

      await connectWith(channel);

      expect(errorLog).toHaveBeenCalledWith(
        { err: expect.objectContaining({ message: 'PRECONDITION_FAILED' }) },
        'Falha ao configurar o canal do RabbitMQ',
      );
      expect(await health.isHealthy()).toBe(false);
      expect(unhandled).not.toHaveBeenCalled();

      // Na próxima reconexão, com a configuração aplicada, volta a ficar pronto.
      manager.emit('disconnect', { err: new Error('connection closed') });
      await connectWith(new FakeAmqpChannel());
      expect(await health.isHealthy()).toBe(true);
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('registra falha de conexão como aviso, no máximo uma vez a cada 30 s', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const fail = () =>
      manager.emit('connectFailed', {
        err: new Error('connect ECONNREFUSED 10.0.0.5:5672'),
        url: 'amqp://pulso:segredo@broker-teste:5672',
      });
    const connectFailedWarnings = () =>
      warnLog.mock.calls.filter(([, message]) => String(message).includes('Não foi possível'));

    fail();
    now.mockReturnValue(1_000_000 + 3_000);
    fail();
    now.mockReturnValue(1_000_000 + CONNECT_FAILED_LOG_INTERVAL_MS - 1);
    fail();
    expect(connectFailedWarnings()).toHaveLength(1);
    expect(connectFailedWarnings()[0][0]).toEqual({
      err: 'connect ECONNREFUSED 10.0.0.5:5672',
      suppressedAttempts: 0,
    });

    now.mockReturnValue(1_000_000 + CONNECT_FAILED_LOG_INTERVAL_MS);
    fail();
    expect(connectFailedWarnings()).toHaveLength(2);
    expect(connectFailedWarnings()[1][0]).toMatchObject({ suppressedAttempts: 2 });
    // A URL (com a senha) nunca é registrada.
    expect(JSON.stringify(warnLog.mock.calls)).not.toContain('segredo');
  });

  it('publish falha depois do tempo limite quando o broker está fora', async () => {
    jest.useFakeTimers();
    const publisher = new EventPublisher(broker, 'identity');
    const envelope = publisher.createEnvelope(EVENTS.USER_REGISTERED, {
      userId: 'u-1',
      name: 'Doador Fictício',
      role: 'DONOR',
    });

    const result = publisher.publish(envelope).then(
      () => 'publicado',
      (error: Error) => error.message,
    );
    jest.advanceTimersByTime(BROKER_PUBLISH_TIMEOUT_MS);

    await expect(result).resolves.toBe('timeout');
  });
});

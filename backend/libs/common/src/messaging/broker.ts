import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as amqp from 'amqp-connection-manager';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import {
  EVENT_EXCHANGE,
  type EventEnvelope,
  type EventPayloads,
  type EventType,
} from '@pulso/contracts';
import { APP_CONFIG, SERVICE_NAME } from '../tokens';
import type { HealthIndicator } from '../health/health';

interface BrokerConfig {
  RABBITMQ_URL: string;
}

/** Tempo máximo de espera para publicar (e ter a confirmação do broker); depois disso, rejeita. */
export const BROKER_PUBLISH_TIMEOUT_MS = 5_000;
/** Intervalo mínimo entre avisos de falha de conexão (as tentativas se repetem a cada 3 s). */
export const CONNECT_FAILED_LOG_INTERVAL_MS = 30_000;

/**
 * Conexão resiliente com o RabbitMQ (reconecta sozinha) e declaração do
 * exchange de eventos de domínio.
 *
 * Falhas não derrubam o processo (RNF17): tentativas de conexão que falham,
 * erros na configuração do canal e o fechamento do canal pelo broker são
 * registrados e refletidos no health check (`broker: down`).
 */
@Injectable()
export class BrokerConnection implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BrokerConnection.name);
  private connection?: amqp.AmqpConnectionManager;
  private channel?: ChannelWrapper;
  /** Canal aberto e com a configuração (exchange) aplicada. */
  private channelReady = false;
  private setupFailed = false;
  private lastConnectFailedLogAt?: number;
  private suppressedConnectFailures = 0;

  constructor(@Inject(APP_CONFIG) private readonly config: BrokerConfig) {}

  onModuleInit(): void {
    this.connection = amqp.connect([this.config.RABBITMQ_URL], {
      heartbeatIntervalInSeconds: 15,
      reconnectTimeInSeconds: 3,
    });
    this.connection.on('connect', () => this.logger.log('Conectado ao RabbitMQ'));
    this.connection.on('connectFailed', ({ err }) => this.onConnectFailed(err));
    this.connection.on('disconnect', ({ err }) => {
      this.channelReady = false;
      this.logger.warn({ err: err?.message }, 'Desconectado do RabbitMQ; tentando reconectar');
    });

    this.channel = this.connection.createChannel({
      json: false,
      confirm: true,
      publishTimeout: BROKER_PUBLISH_TIMEOUT_MS,
      setup: (channel: ConfirmChannel) => this.setupChannel(channel),
    });
    // Emitido depois que toda a configuração do canal terminou.
    this.channel.on('connect', () => {
      this.channelReady = !this.setupFailed;
    });
    // Falha na configuração do canal. Sem este listener, o 'error' derrubaria o processo.
    this.channel.on('error', (err: Error) => {
      this.setupFailed = true;
      this.channelReady = false;
      this.logger.error({ err }, 'Falha ao configurar o canal do RabbitMQ');
    });
    this.channel.on('close', () => {
      this.channelReady = false;
    });
  }

  /** Conectado ao broker e com o canal de publicação pronto. */
  isReady(): boolean {
    return this.isConnected() && this.channelReady;
  }

  isConnected(): boolean {
    return this.connection?.isConnected() ?? false;
  }

  getConnection(): amqp.AmqpConnectionManager {
    if (!this.connection) throw new Error('BrokerConnection ainda não inicializada');
    return this.connection;
  }

  getPublishChannel(): ChannelWrapper {
    if (!this.channel) throw new Error('BrokerConnection ainda não inicializada');
    return this.channel;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  /** Configuração aplicada a cada (re)conexão, no canal do amqplib. */
  private async setupChannel(channel: ConfirmChannel): Promise<void> {
    this.setupFailed = false;
    // O broker fecha o canal em erros de canal (ex.: PRECONDITION_FAILED); sem listener, o
    // 'error' do amqplib derrubaria o processo.
    channel.on('error', (err: Error) =>
      this.logger.error({ err }, 'Canal do RabbitMQ fechado pelo broker com erro'),
    );
    channel.on('close', () => {
      this.channelReady = false;
    });
    await channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
  }

  /** Avisa no máximo uma vez a cada 30 s, com o número de tentativas omitidas. */
  private onConnectFailed(err: Error | undefined): void {
    const now = Date.now();
    if (
      this.lastConnectFailedLogAt !== undefined &&
      now - this.lastConnectFailedLogAt < CONNECT_FAILED_LOG_INTERVAL_MS
    ) {
      this.suppressedConnectFailures += 1;
      return;
    }
    // Só a mensagem: a URL de conexão (com a senha) nunca vai para o log.
    this.logger.warn(
      { err: err?.message, suppressedAttempts: this.suppressedConnectFailures },
      'Não foi possível conectar ao RabbitMQ; tentando novamente',
    );
    this.lastConnectFailedLogAt = now;
    this.suppressedConnectFailures = 0;
  }
}

/** Publica eventos de domínio no exchange `pulso.events` com confirmação do broker. */
@Injectable()
export class EventPublisher {
  constructor(
    private readonly broker: BrokerConnection,
    @Inject(SERVICE_NAME) private readonly serviceName: string,
  ) {}

  /** Monta o envelope padrão de um evento. */
  createEnvelope<T extends EventType>(
    type: T,
    data: EventPayloads[T],
    correlationId?: string,
  ): EventEnvelope<T> {
    return {
      id: randomUUID(),
      type,
      source: this.serviceName,
      occurredAt: new Date().toISOString(),
      correlationId,
      data,
    };
  }

  /**
   * Publica e aguarda a confirmação do broker. Rejeita depois de
   * BROKER_PUBLISH_TIMEOUT_MS se o broker estiver fora (o outbox tenta de novo).
   */
  async publish(envelope: EventEnvelope): Promise<void> {
    await this.broker
      .getPublishChannel()
      .publish(EVENT_EXCHANGE, envelope.type, Buffer.from(JSON.stringify(envelope)), {
        persistent: true,
        contentType: 'application/json',
        messageId: envelope.id,
        type: envelope.type,
        appId: envelope.source,
        timestamp: Math.floor(Date.parse(envelope.occurredAt) / 1000),
      });
  }
}

@Injectable()
export class BrokerHealthIndicator implements HealthIndicator {
  readonly name = 'broker';

  constructor(private readonly broker: BrokerConnection) {}

  async isHealthy(): Promise<boolean> {
    return this.broker.isReady();
  }
}

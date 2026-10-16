import {
  DynamicModule,
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
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

/**
 * Conexão resiliente com o RabbitMQ (reconecta sozinha) e declaração do
 * exchange de eventos de domínio.
 */
@Injectable()
export class BrokerConnection implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BrokerConnection.name);
  private connection?: amqp.AmqpConnectionManager;
  private channel?: ChannelWrapper;

  constructor(@Inject(APP_CONFIG) private readonly config: BrokerConfig) {}

  onModuleInit(): void {
    this.connection = amqp.connect([this.config.RABBITMQ_URL], {
      heartbeatIntervalInSeconds: 15,
      reconnectTimeInSeconds: 3,
    });
    this.connection.on('connect', () => this.logger.log('Conectado ao RabbitMQ'));
    this.connection.on('disconnect', ({ err }) =>
      this.logger.warn({ err: err?.message }, 'Desconectado do RabbitMQ; tentando reconectar'),
    );
    this.channel = this.connection.createChannel({
      json: false,
      confirm: true,
      setup: (channel: ConfirmChannel) =>
        channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true }),
    });
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
    return this.broker.isConnected();
  }
}

@Global()
@Module({})
export class MessagingModule {
  static forRoot(): DynamicModule {
    return {
      module: MessagingModule,
      providers: [BrokerConnection, EventPublisher, BrokerHealthIndicator],
      exports: [BrokerConnection, EventPublisher, BrokerHealthIndicator],
    };
  }
}

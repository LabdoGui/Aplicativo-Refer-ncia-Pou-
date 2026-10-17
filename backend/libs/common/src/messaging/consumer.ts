import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { EVENT_EXCHANGE, type EventEnvelope, type EventType } from '@pulso/contracts';
import type { RawSqlExecutor, TransactionalClient } from '../prisma/raw-client';
import { PRISMA_CLIENT, SERVICE_NAME } from '../tokens';
import { BrokerConnection } from './broker';

/** Tentativas de um evento antes de ir para a fila de mensagens mortas (DLQ). */
export const CONSUMER_MAX_ATTEMPTS = 5;
/** Espera entre tentativas (TTL da fila de retry). */
export const CONSUMER_RETRY_DELAY_MS = 10_000;
export const CONSUMER_PREFETCH = 10;
export const ATTEMPT_HEADER = 'x-pulso-attempt';

/**
 * Trata um evento dentro da transação que também marca o evento como
 * processado: se o tratamento falhar, nada fica gravado e o evento volta.
 */
export type EventHandler<T extends EventType, Tx = RawSqlExecutor> = (
  envelope: EventEnvelope<T>,
  tx: Tx,
) => Promise<void>;

interface RegisteredHandler {
  name: string;
  handle: EventHandler<EventType, unknown>;
}

export function queueNames(serviceName: string) {
  const main = `pulso.${serviceName}`;
  return { main, retry: `${main}.retry`, dead: `${main}.dlq` };
}

function isEnvelope(value: unknown): value is EventEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const { id, type, data } = value as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    /^[0-9a-f-]{36}$/i.test(id) &&
    typeof type === 'string' &&
    typeof data === 'object' &&
    data !== null
  );
}

/**
 * Consumidor de eventos do serviço: uma fila durável `pulso.<serviço>` ligada
 * às routing keys dos handlers registrados, com retry por fila com TTL e DLQ.
 *
 * Idempotência: cada handler grava (evento, handler) em `processed_events` na
 * mesma transação do seu efeito; uma entrega repetida é reconhecida e ignorada.
 */
@Injectable()
export class EventConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(EventConsumer.name);
  private readonly handlers = new Map<EventType, RegisteredHandler[]>();
  private channel?: ChannelWrapper;
  private readonly queues: ReturnType<typeof queueNames>;

  constructor(
    private readonly broker: BrokerConnection,
    @Inject(PRISMA_CLIENT) private readonly prisma: TransactionalClient,
    @Inject(SERVICE_NAME) serviceName: string,
  ) {
    this.queues = queueNames(serviceName);
  }

  /**
   * Registra um handler. Chame em `onModuleInit` (antes do bootstrap da
   * aplicação). `name` identifica o handler na idempotência: não o renomeie
   * com eventos em trânsito.
   */
  on<T extends EventType, Tx = RawSqlExecutor>(
    type: T,
    name: string,
    handle: EventHandler<T, Tx>,
  ): void {
    if (this.channel) throw new Error('Handlers devem ser registrados antes do bootstrap');
    const list = this.handlers.get(type) ?? [];
    if (list.some((handler) => handler.name === name)) {
      throw new Error(`Handler duplicado: ${name} para ${type}`);
    }
    list.push({ name, handle: handle as EventHandler<EventType, unknown> });
    this.handlers.set(type, list);
  }

  onApplicationBootstrap(): void {
    if (this.handlers.size === 0) return;
    const { main, retry, dead } = this.queues;
    const routingKeys = [...this.handlers.keys()];

    this.channel = this.broker.getConnection().createChannel({
      json: false,
      confirm: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(main, { durable: true });
        await channel.assertQueue(dead, { durable: true });
        // Mensagens na fila de retry voltam para a principal depois do TTL.
        await channel.assertQueue(retry, {
          durable: true,
          arguments: {
            'x-message-ttl': CONSUMER_RETRY_DELAY_MS,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': main,
          },
        });
        for (const key of routingKeys) await channel.bindQueue(main, EVENT_EXCHANGE, key);
      },
    });
    this.channel.on('error', (err: Error) =>
      this.logger.error({ err }, 'Falha ao configurar as filas do consumidor'),
    );
    void this.channel
      .consume(main, (message) => this.onMessage(message), { prefetch: CONSUMER_PREFETCH })
      .catch((err: unknown) => this.logger.error({ err }, 'Falha ao iniciar o consumo de eventos'));
    this.logger.log({ queue: main, routingKeys }, 'Consumidor de eventos registrado');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
  }

  /** Processa uma mensagem (público para testes). */
  async onMessage(message: ConsumeMessage): Promise<void> {
    const channel = this.channel;
    if (!channel) return;
    const attempt = Number(message.properties.headers?.[ATTEMPT_HEADER] ?? 1) || 1;

    let envelope: unknown;
    try {
      envelope = JSON.parse(message.content.toString('utf8'));
    } catch {
      envelope = undefined;
    }
    if (!isEnvelope(envelope)) {
      this.logger.error(
        { routingKey: message.fields.routingKey },
        'Mensagem inválida enviada à DLQ',
      );
      await this.sendTo(this.queues.dead, message, attempt, 'envelope inválido');
      channel.ack(message);
      return;
    }

    try {
      await this.dispatch(envelope);
      channel.ack(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const log = { eventId: envelope.id, type: envelope.type, attempt, err: error };
      try {
        if (attempt < CONSUMER_MAX_ATTEMPTS) {
          this.logger.warn(log, 'Falha ao tratar evento; nova tentativa agendada');
          await this.sendTo(this.queues.retry, message, attempt + 1, reason);
        } else {
          this.logger.error(log, 'Evento enviado à DLQ depois de esgotar as tentativas');
          await this.sendTo(this.queues.dead, message, attempt, reason);
        }
        channel.ack(message);
      } catch (republishError) {
        // Sem conseguir reenfileirar, devolve a mensagem para não perdê-la.
        this.logger.error({ ...log, err: republishError }, 'Falha ao reenfileirar evento');
        channel.nack(message, false, true);
      }
    }
  }

  /** Executa os handlers do tipo do evento, cada um na sua transação idempotente. */
  async dispatch(envelope: EventEnvelope): Promise<void> {
    for (const handler of this.handlers.get(envelope.type) ?? []) {
      await this.prisma.$transaction(
        async (tx: RawSqlExecutor) => {
          const inserted = await tx.$executeRawUnsafe(
            `INSERT INTO "processed_events" ("eventId", "consumer", "eventType", "processedAt")
             VALUES ($1::uuid, $2, $3, now()) ON CONFLICT DO NOTHING`,
            envelope.id,
            handler.name,
            envelope.type,
          );
          if (inserted === 0) {
            this.logger.debug(
              { eventId: envelope.id, handler: handler.name },
              'Evento já processado; ignorado',
            );
            return;
          }
          await handler.handle(envelope, tx);
        },
        { timeout: 15_000 },
      );
    }
  }

  private async sendTo(
    queue: string,
    message: ConsumeMessage,
    attempt: number,
    reason: string,
  ): Promise<void> {
    await this.channel!.sendToQueue(queue, message.content, {
      persistent: true,
      contentType: message.properties.contentType,
      messageId: message.properties.messageId,
      type: message.properties.type,
      appId: message.properties.appId,
      timestamp: message.properties.timestamp,
      headers: {
        ...message.properties.headers,
        [ATTEMPT_HEADER]: attempt,
        'x-pulso-last-error': reason.slice(0, 300),
        'x-pulso-original-routing-key': message.fields.routingKey,
      },
    });
  }
}

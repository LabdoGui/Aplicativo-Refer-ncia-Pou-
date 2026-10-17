import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { EventEnvelope, EventPayloads, EventType } from '@pulso/contracts';
import type { RawSqlExecutor } from '../prisma/raw-client';
import { PRISMA_CLIENT } from '../tokens';
import { BrokerConnection, EventPublisher } from './broker';

/** Intervalo da varredura periódica do outbox (rede de segurança). */
export const OUTBOX_POLL_INTERVAL_MS = 2_000;
/** Atraso curto depois de um enqueue, para publicar logo após o commit. */
export const OUTBOX_KICK_DELAY_MS = 100;
export const OUTBOX_BATCH_SIZE = 50;
/** Eventos já publicados são apagados depois deste prazo. */
export const OUTBOX_RETENTION_DAYS = 7;

interface OutboxRow {
  id: string;
  payload: EventEnvelope;
}

/**
 * Publica os eventos gravados na tabela `outbox_events` (padrão transactional
 * outbox): o evento é salvo na mesma transação do dado de negócio e publicado
 * depois, com confirmação do broker. Se o broker estiver fora, os eventos
 * esperam na tabela e saem quando ele voltar (entrega "pelo menos uma vez";
 * os consumidores são idempotentes).
 *
 * Pensado para uma réplica por serviço. Com várias, a leitura precisaria de
 * `FOR UPDATE SKIP LOCKED` para duas réplicas não publicarem o mesmo lote.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private pollTimer?: NodeJS.Timeout;
  private kickTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private flushing?: Promise<void>;
  private stopped = false;

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: RawSqlExecutor,
    private readonly broker: BrokerConnection,
    private readonly publisher: EventPublisher,
  ) {}

  onApplicationBootstrap(): void {
    this.pollTimer = setInterval(() => void this.flush(), OUTBOX_POLL_INTERVAL_MS);
    this.cleanupTimer = setInterval(() => void this.cleanup(), 60 * 60_000);
    this.pollTimer.unref();
    this.cleanupTimer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    clearInterval(this.pollTimer);
    clearInterval(this.cleanupTimer);
    clearTimeout(this.kickTimer);
    await this.flushing;
  }

  /** Pede uma publicação em breve (chamado depois de gravar um evento). */
  kick(): void {
    if (this.stopped || this.kickTimer) return;
    this.kickTimer = setTimeout(() => {
      this.kickTimer = undefined;
      void this.flush();
    }, OUTBOX_KICK_DELAY_MS);
  }

  /** Publica os eventos pendentes, em ordem. Execuções concorrentes viram uma só. */
  flush(): Promise<void> {
    if (this.stopped || !this.broker.isReady()) return Promise.resolve();
    this.flushing ??= this.publishPending().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async publishPending(): Promise<void> {
    try {
      for (;;) {
        const rows = await this.prisma.$queryRawUnsafe<OutboxRow[]>(
          `SELECT "id", "payload" FROM "outbox_events"
            WHERE "publishedAt" IS NULL
            ORDER BY "occurredAt" ASC, "id" ASC
            LIMIT ${OUTBOX_BATCH_SIZE}`,
        );
        for (const row of rows) {
          try {
            await this.publisher.publish(row.payload);
          } catch (error) {
            await this.prisma.$executeRawUnsafe(
              `UPDATE "outbox_events" SET "attempts" = "attempts" + 1, "lastError" = $2 WHERE "id" = $1::uuid`,
              row.id,
              error instanceof Error ? error.message.slice(0, 500) : 'erro desconhecido',
            );
            this.logger.warn(
              { eventId: row.id, type: row.payload.type, err: (error as Error)?.message },
              'Falha ao publicar evento do outbox; nova tentativa na próxima varredura',
            );
            // Mantém a ordem: não pula para os eventos seguintes.
            return;
          }
          await this.prisma.$executeRawUnsafe(
            `UPDATE "outbox_events" SET "publishedAt" = now(), "attempts" = "attempts" + 1, "lastError" = NULL WHERE "id" = $1::uuid`,
            row.id,
          );
          this.logger.debug({ eventId: row.id, type: row.payload.type }, 'Evento publicado');
        }
        if (rows.length < OUTBOX_BATCH_SIZE) return;
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Falha ao ler o outbox');
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "outbox_events" WHERE "publishedAt" < now() - interval '${OUTBOX_RETENTION_DAYS} days'`,
      );
    } catch (error) {
      this.logger.warn({ err: error }, 'Falha na limpeza do outbox');
    }
  }
}

/** Grava eventos de domínio no outbox, dentro da transação do chamador. */
@Injectable()
export class OutboxService {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly relay: OutboxRelay,
  ) {}

  /**
   * Grava o evento usando o cliente da transação (`tx`) do caso de uso, para
   * que dado e evento sejam confirmados (ou desfeitos) juntos.
   */
  async enqueue<T extends EventType>(
    tx: RawSqlExecutor,
    type: T,
    data: EventPayloads[T],
    correlationId?: string,
  ): Promise<EventEnvelope<T>> {
    const envelope = this.publisher.createEnvelope(type, data, correlationId);
    await tx.$executeRawUnsafe(
      `INSERT INTO "outbox_events" ("id", "type", "payload", "occurredAt") VALUES ($1::uuid, $2, $3::jsonb, $4::timestamptz)`,
      envelope.id,
      envelope.type,
      JSON.stringify(envelope),
      envelope.occurredAt,
    );
    this.relay.kick();
    return envelope;
  }
}

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, EventConsumer, InternalHttpClient } from '@pulso/common';
import { EVENTS, type EventEnvelope, type EventPayloads, type EventType } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';
import type { NotificationEnv } from '../config';
import * as messages from './notification-messages';
import type { NotificationDraft } from './notification-messages';

type Tx = Prisma.TransactionClient;
type Builder<T extends EventType> = (
  data: EventPayloads[T],
) => NotificationDraft | NotificationDraft[] | null;

/**
 * Transforma eventos de domínio em notificações in-app.
 *
 * Idempotência em duas camadas: o EventConsumer ignora eventos já tratados
 * (processed_events) e a chave única (sourceEventId, userId, type) impede
 * duplicatas mesmo que o mesmo evento chegue por outro caminho.
 */
@Injectable()
export class NotificationsConsumer implements OnModuleInit {
  constructor(
    private readonly consumer: EventConsumer,
    private readonly http: InternalHttpClient,
    @Inject(APP_CONFIG) private readonly config: NotificationEnv,
  ) {}

  onModuleInit(): void {
    this.register(EVENTS.USER_REGISTERED, 'notify-welcome', messages.welcome);
    this.register(
      EVENTS.APPOINTMENT_BOOKED,
      'notify-appointment-booked',
      messages.appointmentBooked,
    );
    this.register(
      EVENTS.APPOINTMENT_CANCELLED,
      'notify-appointment-cancelled',
      messages.appointmentCancelled,
    );
    this.register(
      EVENTS.APPOINTMENT_RESCHEDULED,
      'notify-appointment-rescheduled',
      messages.appointmentRescheduled,
    );
    this.register(EVENTS.APPOINTMENT_REMINDER_DUE, 'notify-appointment-reminder', (data) =>
      messages.appointmentReminder(data),
    );
    this.register(
      EVENTS.ATTENDANCE_COMPLETED,
      'notify-attendance-completed',
      messages.attendanceCompleted,
    );
    this.register(
      EVENTS.DONATION_COMPLETED,
      'notify-donation-completed',
      messages.donationCompleted,
    );
    this.register(EVENTS.DOCUMENT_ISSUED, 'notify-document-issued', messages.documentIssued);
    this.register(EVENTS.POINTS_AWARDED, 'notify-points-awarded', messages.pointsAwarded);
    this.register(
      EVENTS.ACHIEVEMENT_UNLOCKED,
      'notify-achievement-unlocked',
      messages.achievementUnlocked,
    );
    this.register(EVENTS.HOURS_REVIEWED, 'notify-hours-reviewed', messages.hoursReviewed);
    this.consumer.on<typeof EVENTS.STOCK_LEVEL_CHANGED, Tx>(
      EVENTS.STOCK_LEVEL_CHANGED,
      'notify-stock-alert',
      (envelope, tx) => this.handleStock(envelope, tx),
    );
  }

  /** Alerta de estoque para cada administrador ativo (falha no identity → nova tentativa). */
  async handleStock(
    envelope: EventEnvelope<typeof EVENTS.STOCK_LEVEL_CHANGED>,
    tx: Tx,
  ): Promise<void> {
    if (!messages.shouldAlertStock(envelope.data)) return;
    const admins = await this.http.get<Array<{ id: string }>>(
      this.config.IDENTITY_URL,
      '/api/v1/internal/users',
      { query: { role: 'ADMIN' }, requestId: envelope.correlationId },
    );
    const drafts = messages.stockAlert(
      envelope.data,
      admins.map((admin) => admin.id),
    );
    await save(tx, envelope.id, drafts);
  }

  private register<T extends EventType>(type: T, name: string, build: Builder<T>): void {
    this.consumer.on<T, Tx>(type, name, async (envelope, tx) => {
      const result = build(envelope.data);
      if (!result) return;
      await save(tx, envelope.id, Array.isArray(result) ? result : [result]);
    });
  }
}

/** Grava os rascunhos ignorando os que já existem para o mesmo evento. */
export async function save(
  tx: Tx,
  sourceEventId: string,
  drafts: NotificationDraft[],
): Promise<number> {
  if (drafts.length === 0) return 0;
  const { count } = await tx.notification.createMany({
    data: drafts.map((item) => ({ ...item, sourceEventId })),
    skipDuplicates: true,
  });
  return count;
}

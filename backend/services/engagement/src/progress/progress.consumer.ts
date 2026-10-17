import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventConsumer, OutboxService } from '@pulso/common';
import { EVENTS, type EventEnvelope } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';
import { describeAwards } from '../rules/engagement-rules';
import { ProgressService, type ProgressResult } from './progress.service';

type Tx = Prisma.TransactionClient;

/** Data do fato (occurredAt do payload), com o envelope como reserva. */
function occurredAt(envelope: EventEnvelope, value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(envelope.occurredAt) : date;
}

/**
 * Consome os eventos do clinical e publica (via outbox) os pontos e as
 * conquistas resultantes, que o notification transforma em avisos.
 */
@Injectable()
export class ProgressConsumer implements OnModuleInit {
  constructor(
    private readonly consumer: EventConsumer,
    private readonly progress: ProgressService,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit(): void {
    this.consumer.on(EVENTS.ATTENDANCE_COMPLETED, 'attendance-points', async (envelope, tx: Tx) => {
      const { donorId, campaignId } = envelope.data;
      const result = await this.progress.recordAttendance(tx, {
        donorId,
        campaignId,
        occurredAt: occurredAt(envelope, envelope.data.occurredAt),
        sourceEventId: envelope.id,
      });
      await this.publish(tx, donorId, result, envelope.correlationId);
    });

    this.consumer.on(EVENTS.DONATION_COMPLETED, 'donation-progress', async (envelope, tx: Tx) => {
      const { donorId, campaignId, donationId } = envelope.data;
      const result = await this.progress.recordDonation(tx, {
        donorId,
        donationId,
        campaignId,
        occurredAt: occurredAt(envelope, envelope.data.occurredAt),
        sourceEventId: envelope.id,
      });
      await this.publish(tx, donorId, result, envelope.correlationId);
    });
  }

  private async publish(
    tx: Tx,
    donorId: string,
    result: ProgressResult,
    correlationId?: string,
  ): Promise<void> {
    if (result.pointsAwarded > 0) {
      await this.outbox.enqueue(
        tx,
        EVENTS.POINTS_AWARDED,
        {
          donorId,
          points: result.pointsAwarded,
          reason: describeAwards(result.awards),
          totalPoints: result.totalPoints,
        },
        correlationId,
      );
    }
    for (const achievement of result.unlocked) {
      await this.outbox.enqueue(
        tx,
        EVENTS.ACHIEVEMENT_UNLOCKED,
        { donorId, achievementCode: achievement.code, achievementName: achievement.name },
        correlationId,
      );
    }
  }
}

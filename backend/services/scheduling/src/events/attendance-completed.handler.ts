import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventConsumer } from '@pulso/common';
import { EVENTS } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';

/**
 * Atendimento finalizado no clinical (com ou sem doação) → agendamento
 * concluído. Idempotente: só altera agendamentos ainda em aberto.
 */
@Injectable()
export class AttendanceCompletedHandler implements OnModuleInit {
  constructor(private readonly consumer: EventConsumer) {}

  onModuleInit(): void {
    this.consumer.on<typeof EVENTS.ATTENDANCE_COMPLETED, Prisma.TransactionClient>(
      EVENTS.ATTENDANCE_COMPLETED,
      'complete-appointment',
      async ({ data }, tx) => {
        if (!data.appointmentId) return;
        await tx.appointment.updateMany({
          where: { id: data.appointmentId, status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] } },
          data: { status: 'COMPLETED', completedAt: new Date(data.occurredAt) },
        });
      },
    );
  }
}

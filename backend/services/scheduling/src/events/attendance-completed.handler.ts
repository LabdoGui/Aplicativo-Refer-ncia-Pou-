import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventConsumer } from '@pulso/common';
import { EVENTS } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';
import { UNFINISHED_REASON } from '../appointments/stale-appointments.service';

/**
 * Atendimento finalizado no clinical (com ou sem doação) → agendamento
 * concluído. Idempotente: só altera agendamentos ainda em aberto, ou os que o
 * sistema encerrou por terem ficado com check-in sem atendimento finalizado no
 * dia (a enfermagem finalizou depois).
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
          where: {
            id: data.appointmentId,
            OR: [
              { status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] } },
              {
                status: 'CANCELLED',
                cancelledBy: 'SYSTEM',
                checkedInAt: { not: null },
                cancelReason: UNFINISHED_REASON,
              },
            ],
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(data.occurredAt),
            cancelledAt: null,
            cancelledBy: null,
            cancelReason: null,
          },
        });
      },
    );
  }
}

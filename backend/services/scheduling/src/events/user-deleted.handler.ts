import { Injectable, OnModuleInit } from '@nestjs/common';
import { AuditService, EventConsumer, recordDeletedAccount } from '@pulso/common';
import { EVENTS } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';
import { releaseSlot } from '../appointments/slot-ledger';

/**
 * Conta excluída (LGPD) → agendamentos ainda não atendidos são cancelados pelo
 * sistema e as vagas voltam para a agenda. O histórico já atendido fica, ligado
 * só ao identificador. Sem notificação: a conta não existe mais.
 */
@Injectable()
export class UserDeletedHandler implements OnModuleInit {
  constructor(
    private readonly consumer: EventConsumer,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.consumer.on<typeof EVENTS.USER_DELETED, Prisma.TransactionClient>(
      EVENTS.USER_DELETED,
      'cancel-open-appointments',
      async ({ data, correlationId }, tx) => {
        await recordDeletedAccount(tx, data.userId);
        const open = await tx.appointment.findMany({
          where: { donorId: data.userId, status: { in: ['BOOKED', 'CONFIRMED'] } },
          select: { id: true, slotId: true },
        });
        for (const appointment of open) {
          const { count } = await tx.appointment.updateMany({
            where: { id: appointment.id, status: { in: ['BOOKED', 'CONFIRMED'] } },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelledBy: 'SYSTEM',
              cancelReason: 'Conta excluída pelo titular.',
            },
          });
          if (count === 0) continue;
          await releaseSlot(tx, appointment.slotId);
          await this.audit.record(
            {
              actor: null,
              action: 'appointment.cancelled',
              entity: 'appointment',
              entityId: appointment.id,
              metadata: { cancelledBy: 'SYSTEM', reason: 'account_deleted' },
              requestId: correlationId,
            },
            tx,
          );
        }
      },
    );
  }
}

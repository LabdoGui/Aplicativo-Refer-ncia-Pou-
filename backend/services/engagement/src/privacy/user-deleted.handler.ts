import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventConsumer, recordDeletedAccount } from '@pulso/common';
import { EVENTS } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';

/**
 * Conta excluída (LGPD) → o doador sai do ranking (apelido apagado), perde o
 * vínculo com a instituição e os pedidos de horas ainda pendentes são
 * descartados. Pontos e conquistas já ganhos ficam, ligados só ao id.
 */
@Injectable()
export class UserDeletedHandler implements OnModuleInit {
  constructor(private readonly consumer: EventConsumer) {}

  onModuleInit(): void {
    this.consumer.on<typeof EVENTS.USER_DELETED, Prisma.TransactionClient>(
      EVENTS.USER_DELETED,
      'erase-public-profile',
      async ({ data }, tx) => {
        await recordDeletedAccount(tx, data.userId);
        await tx.complementaryHours.deleteMany({
          where: { donorId: data.userId, status: 'PENDING' },
        });
        await tx.donorEngagement.updateMany({
          where: { donorId: data.userId },
          data: { rankingOptIn: false, nickname: null, institutionId: null },
        });
      },
    );
  }
}

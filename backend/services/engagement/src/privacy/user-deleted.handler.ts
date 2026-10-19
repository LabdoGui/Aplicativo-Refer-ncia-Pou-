import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventConsumer } from '@pulso/common';
import { EVENTS } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';

/**
 * Conta excluída (LGPD) → o doador sai do ranking (apelido apagado) e perde o
 * vínculo com a instituição. Pontos e conquistas ficam, ligados só ao id.
 */
@Injectable()
export class UserDeletedHandler implements OnModuleInit {
  constructor(private readonly consumer: EventConsumer) {}

  onModuleInit(): void {
    this.consumer.on<typeof EVENTS.USER_DELETED, Prisma.TransactionClient>(
      EVENTS.USER_DELETED,
      'erase-public-profile',
      async ({ data }, tx) => {
        await tx.donorEngagement.updateMany({
          where: { donorId: data.userId },
          data: { rankingOptIn: false, nickname: null, institutionId: null },
        });
      },
    );
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventConsumer, FieldEncryption } from '@pulso/common';
import { EVENTS } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';

/**
 * Conta excluída (LGPD) → respostas e orientações da pré-triagem são apagadas
 * (fica só o resultado, para as estatísticas) e os PDFs emitidos, que trazem o
 * nome do titular, são descartados; o código de verificação continua válido e
 * mostra só as iniciais. Triagem e doação ficam pseudonimizadas (só o id), por
 * obrigação de guarda da instituição de saúde.
 */
@Injectable()
export class UserDeletedHandler implements OnModuleInit {
  constructor(
    private readonly consumer: EventConsumer,
    private readonly encryption: FieldEncryption,
  ) {}

  onModuleInit(): void {
    this.consumer.on<typeof EVENTS.USER_DELETED, Prisma.TransactionClient>(
      EVENTS.USER_DELETED,
      'erase-donor-data',
      async ({ data }, tx) => {
        await tx.preScreening.updateMany({
          where: { donorId: data.userId },
          data: {
            answersEncrypted: null,
            sharedWithStaff: false,
            guidanceEncrypted: this.encryption.encryptJson([]),
          },
        });
        await tx.document.updateMany({
          where: { donorId: data.userId },
          data: { pdf: new Uint8Array(0) },
        });
      },
    );
  }
}

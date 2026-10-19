import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Minimização (LGPD): depois da validade, as respostas compartilhadas da
 * pré-triagem não servem a mais nada (a equipe só vê pré-triagens válidas),
 * então são apagadas. Fica só o resultado, para as estatísticas. Roda todo dia.
 */
@Injectable()
export class AnswersRetentionJob {
  private readonly logger = new Logger(AnswersRetentionJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 15 3 * * *')
  async run(): Promise<number> {
    try {
      return await this.purgeExpired(new Date());
    } catch (error) {
      this.logger.error({ err: error }, 'Falha ao apagar respostas vencidas da pré-triagem');
      return 0;
    }
  }

  async purgeExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.preScreening.updateMany({
      where: { answersEncrypted: { not: null }, expiresAt: { lt: now } },
      data: { answersEncrypted: null, sharedWithStaff: false },
    });
    if (count > 0) this.logger.log({ count }, 'Respostas vencidas da pré-triagem apagadas');
    return count;
  }
}

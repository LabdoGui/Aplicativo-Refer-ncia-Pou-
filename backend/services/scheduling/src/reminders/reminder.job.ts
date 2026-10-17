import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutboxService } from '@pulso/common';
import { EVENTS } from '@pulso/contracts';
import { PrismaService } from '../prisma/prisma.service';

/** Antecedência do lembrete. */
export const REMINDER_WINDOW_HOURS = 24;
/** Agendamentos feitos há menos disso não recebem lembrete (a confirmação acabou de chegar). */
export const REMINDER_MIN_AGE_MINUTES = 60;
const BATCH = 200;

/**
 * Lembretes: a cada 10 minutos, agendamentos em aberto que começam nas próximas
 * 24 horas geram `scheduling.appointment.reminder_due` (o notification avisa o
 * doador). O UPDATE condicional em `reminderSentAt` evita lembrete duplicado
 * mesmo com execuções sobrepostas.
 */
@Injectable()
export class ReminderJob {
  private readonly logger = new Logger(ReminderJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  @Cron('0 */10 * * * *')
  async run(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.sendDueReminders(new Date());
    } catch (error) {
      this.logger.error({ err: error }, 'Falha ao gerar lembretes de agendamento');
      return 0;
    } finally {
      this.running = false;
    }
  }

  async sendDueReminders(now: Date): Promise<number> {
    const due = await this.prisma.appointment.findMany({
      where: {
        status: { in: ['BOOKED', 'CONFIRMED'] },
        reminderSentAt: null,
        startsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3_600_000) },
        createdAt: { lt: new Date(now.getTime() - REMINDER_MIN_AGE_MINUTES * 60_000) },
      },
      include: { unit: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
      take: BATCH,
    });
    let sent = 0;
    for (const appointment of due) {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.appointment.updateMany({
          where: {
            id: appointment.id,
            reminderSentAt: null,
            status: { in: ['BOOKED', 'CONFIRMED'] },
          },
          data: { reminderSentAt: now },
        });
        if (count === 0) return;
        await this.outbox.enqueue(tx, EVENTS.APPOINTMENT_REMINDER_DUE, {
          appointmentId: appointment.id,
          donorId: appointment.donorId,
          unitName: appointment.unit.name,
          startsAt: appointment.startsAt.toISOString(),
        });
        sent += 1;
      });
    }
    if (sent > 0) this.logger.log({ sent }, 'Lembretes de agendamento gerados');
    return sent;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { AuditService } from '@pulso/common';
import { DEFAULT_TIMEZONE } from '@pulso/contracts';
import { PrismaService } from '../prisma/prisma.service';

/** Tolerância depois do fim da vaga antes de o agendamento virar falta automática. */
export const NO_SHOW_GRACE_HOURS = 2;

export const UNFINISHED_REASON = 'Atendimento não finalizado no dia do agendamento.';

/**
 * Encerra agendamentos que ficaram para trás, para que não prendam o doador
 * (RN03: um agendamento ativo por vez) nem a agenda:
 *  - em aberto (BOOKED/CONFIRMED) duas horas depois do fim da vaga → falta;
 *  - com check-in de um dia anterior, sem atendimento finalizado → cancelado
 *    pelo sistema. Se a enfermagem ainda finalizar esse atendimento, o evento
 *    clinical.attendance.completed conclui o agendamento normalmente.
 * Roda a cada 15 minutos e, para o próprio doador, antes de uma nova reserva.
 */
@Injectable()
export class StaleAppointmentsService {
  private readonly logger = new Logger(StaleAppointmentsService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Cron('0 */15 * * * *')
  async run(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.expire(new Date());
    } catch (error) {
      this.logger.error({ err: error }, 'Falha ao encerrar agendamentos vencidos');
      return 0;
    } finally {
      this.running = false;
    }
  }

  /** Encerra os agendamentos vencidos (de todos ou de um doador). Devolve quantos mudaram. */
  async expire(now: Date, donorId?: string): Promise<number> {
    const noShowCutoff = new Date(now.getTime() - NO_SHOW_GRACE_HOURS * 3_600_000);
    const startOfToday = DateTime.fromJSDate(now, { zone: DEFAULT_TIMEZONE })
      .startOf('day')
      .toJSDate();
    // $1 = agora, $2 = limite, $3 = doador (opcional).
    const donorFilter = donorId ? `AND "donorId" = $3::uuid` : '';
    const params = (cutoff: Date) => [
      now.toISOString(),
      cutoff.toISOString(),
      ...(donorId ? [donorId] : []),
    ];

    return this.prisma.$transaction(async (tx) => {
      const noShows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE "appointments"
            SET "status" = 'NO_SHOW', "noShowAt" = $1::timestamptz, "updatedAt" = $1::timestamptz
          WHERE "status" IN ('BOOKED', 'CONFIRMED') AND "endsAt" < $2::timestamptz ${donorFilter}
          RETURNING "id"`,
        ...params(noShowCutoff),
      );
      const unfinished = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE "appointments"
            SET "status" = 'CANCELLED', "cancelledAt" = $1::timestamptz, "cancelledBy" = 'SYSTEM',
                "cancelReason" = '${UNFINISHED_REASON}', "updatedAt" = $1::timestamptz
          WHERE "status" = 'CHECKED_IN' AND "startsAt" < $2::timestamptz ${donorFilter}
          RETURNING "id"`,
        ...params(startOfToday),
      );
      for (const { id } of noShows) {
        await this.audit.record(
          {
            actor: null,
            action: 'appointment.no_show',
            entity: 'appointment',
            entityId: id,
            metadata: { automatic: true },
          },
          tx,
        );
      }
      for (const { id } of unfinished) {
        await this.audit.record(
          {
            actor: null,
            action: 'appointment.cancelled',
            entity: 'appointment',
            entityId: id,
            metadata: { cancelledBy: 'SYSTEM', reason: 'unfinished_attendance' },
          },
          tx,
        );
      }
      const total = noShows.length + unfinished.length;
      if (total > 0 && !donorId) {
        this.logger.log(
          { noShows: noShows.length, unfinished: unfinished.length },
          'Agendamentos vencidos encerrados',
        );
      }
      return total;
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import {
  APP_CONFIG,
  AppException,
  assertUnitScope,
  AuditService,
  localDayRange,
  todayLocal,
  toLocalDate,
} from '@pulso/common';
import type { AgendaResponse, AuthUser, StaffAppointmentView } from '@pulso/contracts';
import {
  APPOINTMENT_INCLUDE,
  emptyStatusCounts,
  toAgendaItem,
  type AppointmentWithRelations,
} from '../appointments/appointment.mapper';
import type { SchedulingEnv } from '../config';
import { DonorDirectory } from '../identity/donor-directory';
import { PrismaService } from '../prisma/prisma.service';
import type { AgendaQueryDto } from './dto/agenda.dto';

/**
 * Agenda do dia da equipe da unidade: lista, detalhe com o resumo do doador,
 * check-in e falta. Sem os nomes (identity fora do ar), a resposta é 503: uma
 * agenda sem saber quem é cada doador não serve ao atendimento.
 */
@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly donors: DonorDirectory,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: SchedulingEnv,
  ) {}

  async agenda(user: AuthUser, query: AgendaQueryDto, requestId?: string): Promise<AgendaResponse> {
    assertUnitScope(user, query.unitId);
    const unit = await this.prisma.healthUnit.findUnique({ where: { id: query.unitId } });
    if (!unit) throw new AppException(404, 'UNIT_NOT_FOUND', 'Unidade não encontrada.');
    const date = query.date ?? todayLocal(unit.timezone);
    const { start, end } = localDayRange(date, date, unit.timezone);
    const appointments = await this.prisma.appointment.findMany({
      where: { unitId: unit.id, startsAt: { gte: start, lte: end } },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ startsAt: 'asc' }, { code: 'asc' }],
    });
    const summaries = await this.donors.summaries(
      appointments.map((appointment) => appointment.donorId),
      requestId,
    );
    const counts = emptyStatusCounts();
    for (const appointment of appointments) counts[appointment.status] += 1;
    return {
      unit: { id: unit.id, name: unit.name },
      date,
      items: appointments.map((appointment) =>
        toAgendaItem(appointment, summaries.get(appointment.donorId)),
      ),
      counts,
      earlyCheckInAllowed: this.config.DEMO_EARLY_CHECK_IN,
    };
  }

  async staffView(user: AuthUser, id: string, requestId?: string): Promise<StaffAppointmentView> {
    const appointment = await this.findInScope(user, id);
    return this.toStaffView(appointment, requestId);
  }

  /**
   * Check-in só no dia do agendamento (no fuso da unidade). Com
   * DEMO_EARLY_CHECK_IN, também de dias futuros (demonstração da jornada).
   */
  async checkIn(user: AuthUser, id: string, requestId?: string): Promise<StaffAppointmentView> {
    const appointment = await this.findInScope(user, id);
    if (appointment.status !== 'BOOKED' && appointment.status !== 'CONFIRMED') {
      throw new AppException(
        409,
        'INVALID_STATUS',
        'Este agendamento não está aguardando check-in.',
      );
    }
    const zone = appointment.unit.timezone;
    const appointmentDay = toLocalDate(appointment.startsAt, zone);
    const today = todayLocal(zone);
    const early = appointmentDay > today;
    if (appointmentDay < today || (early && !this.config.DEMO_EARLY_CHECK_IN)) {
      throw new AppException(
        422,
        'CHECK_IN_NOT_TODAY',
        'O check-in só pode ser feito no dia do agendamento.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.appointment.updateMany({
        where: { id, status: { in: ['BOOKED', 'CONFIRMED'] } },
        data: { status: 'CHECKED_IN', checkedInAt: new Date(), checkedInById: user.id },
      });
      if (count === 0) {
        throw new AppException(
          409,
          'INVALID_STATUS',
          'Este agendamento mudou de situação. Atualize a agenda.',
        );
      }
      await this.audit.record(
        {
          actor: user,
          action: 'appointment.checked_in',
          entity: 'appointment',
          entityId: id,
          metadata: early ? { earlyCheckIn: true } : undefined,
          requestId,
        },
        tx,
      );
    });
    return this.staffView(user, id, requestId);
  }

  /** Falta: só depois do horário marcado. A vaga não é devolvida (o horário já passou). */
  async noShow(user: AuthUser, id: string, requestId?: string): Promise<StaffAppointmentView> {
    const appointment = await this.findInScope(user, id);
    if (appointment.status !== 'BOOKED' && appointment.status !== 'CONFIRMED') {
      throw new AppException(
        409,
        'INVALID_STATUS',
        'Só é possível registrar falta de agendamentos em aberto.',
      );
    }
    if (appointment.startsAt > new Date()) {
      throw new AppException(
        422,
        'NOT_STARTED',
        'Só é possível registrar falta depois do horário agendado.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.appointment.updateMany({
        where: { id, status: { in: ['BOOKED', 'CONFIRMED'] } },
        data: { status: 'NO_SHOW', noShowAt: new Date() },
      });
      if (count === 0) {
        throw new AppException(
          409,
          'INVALID_STATUS',
          'Este agendamento mudou de situação. Atualize a agenda.',
        );
      }
      await this.audit.record(
        {
          actor: user,
          action: 'appointment.no_show',
          entity: 'appointment',
          entityId: id,
          requestId,
        },
        tx,
      );
    });
    return this.staffView(user, id, requestId);
  }

  private async findInScope(user: AuthUser, id: string): Promise<AppointmentWithRelations> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) {
      throw new AppException(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    }
    assertUnitScope(user, appointment.unitId);
    return appointment;
  }

  private async toStaffView(
    appointment: AppointmentWithRelations,
    requestId?: string,
  ): Promise<StaffAppointmentView> {
    const donorSummary = await this.donors.summary(appointment.donorId, requestId);
    return {
      ...toAgendaItem(appointment, donorSummary),
      unit: { id: appointment.unit.id, name: appointment.unit.name },
      donorSummary,
    };
  }
}

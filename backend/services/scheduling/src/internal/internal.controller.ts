import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  AppException,
  eachLocalDay,
  InternalOnly,
  StatsQueryDto,
  statsRange,
  toLocalDate,
} from '@pulso/common';
import type { InternalAppointmentView, SchedulingStats } from '@pulso/contracts';
import { emptyStatusCounts } from '../appointments/appointment.mapper';
import { PrismaService } from '../prisma/prisma.service';

/** Rotas entre serviços (token interno); o gateway bloqueia /internal para fora. */
@ApiExcludeController()
@InternalOnly()
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  /** Usado pelo clinical ao registrar a triagem (unidade, situação e campanha do agendamento). */
  @Get('appointments/:id')
  async appointment(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InternalAppointmentView> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { unit: { select: { name: true } }, campaign: { select: { title: true } } },
    });
    if (!appointment) {
      throw new AppException(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    }
    return {
      id: appointment.id,
      code: appointment.code,
      donorId: appointment.donorId,
      unitId: appointment.unitId,
      unitName: appointment.unit.name,
      status: appointment.status,
      startsAt: appointment.startsAt.toISOString(),
      campaignId: appointment.campaignId,
      campaignTitle: appointment.campaign?.title ?? null,
    };
  }

  /** Indicadores de agendamento por período (dashboard; composição no gateway). */
  @Get('stats')
  async stats(@Query() query: StatsQueryDto): Promise<SchedulingStats> {
    const { start, end } = statsRange(query);
    const unitFilter = query.unitId ? { unitId: query.unitId } : {};
    const [appointments, upcoming, activeUnits] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...unitFilter, startsAt: { gte: start, lte: end } },
        select: { status: true, startsAt: true },
      }),
      this.prisma.appointment.count({
        where: {
          ...unitFilter,
          status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] },
          startsAt: { gte: new Date() },
        },
      }),
      this.prisma.healthUnit.count({ where: { status: 'ACTIVE' } }),
    ]);

    const byStatus = emptyStatusCounts();
    const perDay = new Map<string, number>();
    for (const appointment of appointments) {
      byStatus[appointment.status] += 1;
      const day = toLocalDate(appointment.startsAt);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    const attended = byStatus.COMPLETED;
    const decided = attended + byStatus.NO_SHOW;
    return {
      appointmentsTotal: appointments.length,
      byStatus,
      byDay: eachLocalDay(query.from, query.to).map((date) => ({
        date,
        count: perDay.get(date) ?? 0,
      })),
      attendanceRate: decided > 0 ? Math.round((attended / decided) * 1000) / 1000 : null,
      upcoming,
      activeUnits,
    };
  }
}

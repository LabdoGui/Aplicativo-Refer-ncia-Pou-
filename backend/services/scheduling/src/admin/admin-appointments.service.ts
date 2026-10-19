import { Injectable } from '@nestjs/common';
import { AppException, localDayRange, pageParams, paginated } from '@pulso/common';
import type { AdminAppointmentItem, Paginated } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';
import { APPOINTMENT_INCLUDE, toAgendaItem } from '../appointments/appointment.mapper';
import { DonorDirectory } from '../identity/donor-directory';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminAppointmentsQueryDto } from './dto/admin-appointments.dto';

@Injectable()
export class AdminAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly donors: DonorDirectory,
  ) {}

  async list(
    query: AdminAppointmentsQueryDto,
    requestId?: string,
  ): Promise<Paginated<AdminAppointmentItem>> {
    const { skip, take, page, pageSize } = pageParams(query);
    if (query.from && query.to && query.from > query.to) {
      throw new AppException(400, 'INVALID_PERIOD', 'A data inicial deve ser anterior à final.');
    }
    const startsAt: Prisma.DateTimeFilter = {};
    if (query.from) startsAt.gte = localDayRange(query.from, query.from).start;
    if (query.to) startsAt.lte = localDayRange(query.to, query.to).end;
    const where: Prisma.AppointmentWhereInput = {
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to ? { startsAt } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: APPOINTMENT_INCLUDE,
        orderBy: { startsAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    const summaries = await this.donors.summaries(
      rows.map((row) => row.donorId),
      requestId,
    );
    return paginated(
      rows.map((row) => ({
        ...toAgendaItem(row, summaries.get(row.donorId)),
        unit: { id: row.unit.id, name: row.unit.name },
        cancelledBy: row.cancelledBy,
      })),
      total,
      page,
      pageSize,
    );
  }
}

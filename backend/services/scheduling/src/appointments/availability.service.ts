import { Injectable } from '@nestjs/common';
import { AppException, eachLocalDay, localDayRange } from '@pulso/common';
import type { AvailabilityResponse } from '@pulso/contracts';
import { bookingWindow, dayAvailability, slotsForDay, type SlotUsage } from '../domain/schedule';
import { PrismaService } from '../prisma/prisma.service';
import type { AvailabilityQueryDto } from './dto/appointments.dto';

/** Maior intervalo consultado de uma vez. */
export const MAX_AVAILABILITY_DAYS = 31;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vagas por dia, dentro da janela de agendamento (RN05). Vagas lotadas vêm
   * com `remaining = 0` (a interface mostra "lotado"); vagas bloqueadas, antes
   * da antecedência mínima ou fora da grade não aparecem.
   */
  async availability(query: AvailabilityQueryDto): Promise<AvailabilityResponse> {
    const unit = await this.prisma.healthUnit.findUnique({ where: { id: query.unitId } });
    if (!unit || unit.status !== 'ACTIVE') {
      throw new AppException(404, 'UNIT_NOT_FOUND', 'Unidade não encontrada.');
    }
    if (query.from > query.to) {
      throw new AppException(400, 'INVALID_PERIOD', 'A data inicial deve ser anterior à final.');
    }
    if (eachLocalDay(query.from, query.to).length > MAX_AVAILABILITY_DAYS) {
      throw new AppException(
        400,
        'INVALID_PERIOD',
        `Consulte no máximo ${MAX_AVAILABILITY_DAYS} dias por vez.`,
      );
    }

    const zone = unit.timezone;
    const window = bookingWindow(new Date(), zone);
    const from = query.from > window.firstDay ? query.from : window.firstDay;
    const to = query.to < window.lastDay ? query.to : window.lastDay;
    if (from > to) return { unitId: unit.id, timezone: zone, days: [] };

    const { start, end } = localDayRange(from, to, zone);
    const [rules, blocks, slots] = await Promise.all([
      this.prisma.scheduleRule.findMany({ where: { unitId: unit.id, active: true } }),
      this.prisma.scheduleBlock.findMany({
        where: { unitId: unit.id, startsAt: { lt: end }, endsAt: { gt: start } },
      }),
      this.prisma.slot.findMany({
        where: { unitId: unit.id, startsAt: { gte: start, lte: end } },
        select: { startsAt: true, bookedCount: true },
      }),
    ]);
    const usage = new Map<number, SlotUsage>(
      slots.map((slot) => [slot.startsAt.getTime(), { bookedCount: slot.bookedCount }]),
    );

    return {
      unitId: unit.id,
      timezone: zone,
      days: eachLocalDay(from, to).map((date) => ({
        date,
        slots: dayAvailability({
          generated: slotsForDay(rules, date, zone),
          blocks,
          usage,
          earliest: window.earliest,
        }),
      })),
    };
  }
}

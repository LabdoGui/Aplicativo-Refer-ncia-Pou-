import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalOnly, StatsQueryDto, statsRange } from '@pulso/common';
import type { ClinicalStats } from '@pulso/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { buildClinicalStats } from './clinical-stats';

/** Rotas entre serviços (token interno); o gateway bloqueia /internal para fora. */
@ApiExcludeController()
@InternalOnly()
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats(@Query() query: StatsQueryDto): Promise<ClinicalStats> {
    const { start, end } = statsRange(query);
    const period = { gte: start, lte: end };
    const [donations, attendances, preScreenings] = await Promise.all([
      this.prisma.donation.findMany({
        where: {
          occurredAt: period,
          ...(query.unitId ? { unitId: query.unitId } : {}),
          ...(query.bloodType ? { bloodType: query.bloodType } : {}),
        },
        select: {
          status: true,
          bloodType: true,
          volumeMl: true,
          unitId: true,
          unitName: true,
          occurredAt: true,
        },
      }),
      this.prisma.professionalScreening.findMany({
        where: { createdAt: period, ...(query.unitId ? { unitId: query.unitId } : {}) },
        select: { result: true },
      }),
      // A pré-triagem não tem unidade: o filtro de unidade não se aplica a ela.
      this.prisma.preScreening.findMany({ where: { createdAt: period }, select: { result: true } }),
    ]);
    return buildClinicalStats({
      from: query.from,
      to: query.to,
      donations,
      attendances,
      preScreenings,
    });
  }
}

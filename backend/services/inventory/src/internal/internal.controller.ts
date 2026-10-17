import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalOnly, StatsQueryDto, statsRange } from '@pulso/common';
import {
  BLOOD_TYPES,
  stockStatusFor,
  type InventoryStats,
  type StockStatus,
} from '@pulso/contracts';
import { PrismaService } from '../prisma/prisma.service';

/** Rotas entre serviços (token interno); o gateway bloqueia /internal para fora. */
@ApiExcludeController()
@InternalOnly()
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Indicadores para o dashboard. Com `bloodType`, níveis e movimentações
   * ficam restritos a esse tipo. `unitId` é ignorado: o estoque é central (D6).
   */
  @Get('stats')
  async stats(@Query() query: StatsQueryDto): Promise<InventoryStats> {
    const { start, end } = statsRange(query);
    const typeFilter = query.bloodType ? { bloodType: query.bloodType } : {};
    const [stock, moved] = await Promise.all([
      this.prisma.bloodStock.findMany({ where: typeFilter }),
      this.prisma.stockMovement.groupBy({
        by: ['type'],
        where: { ...typeFilter, occurredAt: { gte: start, lte: end } },
        _sum: { quantity: true },
      }),
    ]);
    const levels = BLOOD_TYPES.flatMap((type) => {
      const row = stock.find((item) => item.bloodType === type);
      return row
        ? [
            {
              bloodType: type,
              quantity: row.quantity,
              status: stockStatusFor(row.quantity, row.minimum, row.ideal),
            },
          ]
        : [];
    });
    const byStatus: Record<StockStatus, number> = { NORMAL: 0, ATTENTION: 0, CRITICAL: 0 };
    for (const level of levels) byStatus[level.status] += 1;
    const sumOf = (type: 'IN' | 'OUT') =>
      moved.find((row) => row.type === type)?._sum.quantity ?? 0;
    return {
      totalBags: levels.reduce((sum, level) => sum + level.quantity, 0),
      byStatus,
      levels,
      movementsIn: sumOf('IN'),
      movementsOut: sumOf('OUT'),
    };
  }
}

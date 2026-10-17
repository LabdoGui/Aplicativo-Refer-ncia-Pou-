import { Injectable } from '@nestjs/common';
import { AppException, AuditService, OutboxService, todayLocal } from '@pulso/common';
import {
  BLOOD_TYPE_LABELS,
  BLOOD_TYPES,
  EVENTS,
  stockStatusFor,
  type AuthUser,
  type BloodType,
  type PublicStockLevel,
  type StockHistoryResponse,
  type StockItemView,
  type StockOverview,
} from '@pulso/contracts';
import type { BloodStock } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateThresholdsDto } from './dto/stock.dto';
import {
  computeTrend,
  emptyBalances,
  endOfLocalDay,
  lastLocalDays,
  reconstructDailyBalances,
  type BalanceByType,
} from './stock-history';

/** Dias da minissérie (sparkline) de cada tipo; o último é hoje. */
export const SPARKLINE_DAYS = 14;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async overview(): Promise<StockOverview> {
    const rows = await this.loadStock();
    const days = lastLocalDays(SPARKLINE_DAYS, todayLocal());
    const points = await this.dailyBalances(rows, days);
    const items = BLOOD_TYPES.map((type) => this.toItem(rows.get(type)!, points, type));
    return {
      items,
      totals: {
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        critical: items.filter((item) => item.status === 'CRITICAL').length,
        attention: items.filter((item) => item.status === 'ATTENTION').length,
        normal: items.filter((item) => item.status === 'NORMAL').length,
      },
      updatedAt: new Date(
        Math.max(...items.map((item) => Date.parse(item.updatedAt))),
      ).toISOString(),
    };
  }

  async publicLevels(): Promise<PublicStockLevel[]> {
    const rows = await this.loadStock();
    return BLOOD_TYPES.map((type) => {
      const row = rows.get(type)!;
      return { bloodType: type, status: stockStatusFor(row.quantity, row.minimum, row.ideal) };
    });
  }

  async history(daysCount: number): Promise<StockHistoryResponse> {
    const rows = await this.loadStock();
    const days = lastLocalDays(daysCount, todayLocal());
    return { days: daysCount, points: await this.dailyBalances(rows, days) };
  }

  async updateThresholds(
    actor: AuthUser,
    bloodType: BloodType,
    dto: UpdateThresholdsDto,
    requestId?: string,
  ): Promise<StockItemView> {
    if (dto.ideal < dto.minimum) {
      throw new AppException(
        400,
        'INVALID_THRESHOLDS',
        'O nível ideal precisa ser maior ou igual ao mínimo.',
        undefined,
        [{ field: 'ideal', message: 'Informe um valor maior ou igual ao mínimo.' }],
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<BloodStock[]>`
        SELECT "bloodType", "quantity", "minimum", "ideal"
          FROM "blood_stock" WHERE "bloodType" = ${bloodType}::"BloodType" FOR UPDATE`;
      if (!locked) {
        throw new AppException(404, 'STOCK_NOT_FOUND', 'Tipo sanguíneo não encontrado no estoque.');
      }
      const previousStatus = stockStatusFor(locked.quantity, locked.minimum, locked.ideal);
      const status = stockStatusFor(locked.quantity, dto.minimum, dto.ideal);
      await tx.bloodStock.update({
        where: { bloodType },
        data: { minimum: dto.minimum, ideal: dto.ideal },
      });
      if (status !== previousStatus) {
        await this.outbox.enqueue(
          tx,
          EVENTS.STOCK_LEVEL_CHANGED,
          { bloodType, previousStatus, status, quantity: locked.quantity },
          requestId,
        );
      }
      await this.audit.record(
        {
          actor,
          action: 'stock.thresholds_updated',
          entity: 'blood_stock',
          entityId: bloodType,
          metadata: {
            bloodType,
            minimum: dto.minimum,
            ideal: dto.ideal,
            previous: { minimum: locked.minimum, ideal: locked.ideal },
          },
          requestId,
        },
        tx,
      );
    });
    const overview = await this.overview();
    return overview.items.find((item) => item.bloodType === bloodType)!;
  }

  /** Linhas do estoque por tipo; os 8 tipos precisam existir (criados pelo seed/migração). */
  private async loadStock(): Promise<Map<BloodType, BloodStock>> {
    const rows = await this.prisma.bloodStock.findMany();
    const byType = new Map(rows.map((row) => [row.bloodType as BloodType, row]));
    const missing = BLOOD_TYPES.filter((type) => !byType.has(type));
    if (missing.length > 0) {
      throw new AppException(
        503,
        'STOCK_NOT_INITIALIZED',
        `O estoque ainda não foi configurado para: ${missing.map((type) => BLOOD_TYPE_LABELS[type]).join(', ')}.`,
      );
    }
    return byType;
  }

  private async dailyBalances(rows: Map<BloodType, BloodStock>, days: string[]) {
    const current: BalanceByType = emptyBalances();
    for (const [type, row] of rows) current[type] = row.quantity;
    const movements = await this.prisma.stockMovement.findMany({
      where: { occurredAt: { gt: endOfLocalDay(days[0]) } },
      select: { bloodType: true, type: true, quantity: true, occurredAt: true },
    });
    return reconstructDailyBalances(current, movements, days);
  }

  private toItem(
    row: BloodStock,
    points: ReturnType<typeof reconstructDailyBalances>,
    type: BloodType,
  ): StockItemView {
    const sparkline = points.map((point) => point.values[type]);
    // 7 dias atrás = penúltima semana da série (o último ponto é hoje).
    const weekAgo = sparkline[sparkline.length - 8] ?? sparkline[0];
    return {
      bloodType: type,
      quantity: row.quantity,
      minimum: row.minimum,
      ideal: row.ideal,
      status: stockStatusFor(row.quantity, row.minimum, row.ideal),
      trend: computeTrend(row.quantity, weekAgo),
      sparkline,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

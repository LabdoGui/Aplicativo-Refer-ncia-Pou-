import { Injectable } from '@nestjs/common';
import {
  AppException,
  AuditService,
  localDayRange,
  OutboxService,
  pageParams,
  paginated,
} from '@pulso/common';
import {
  BLOOD_TYPE_LABELS,
  EVENTS,
  MOVEMENT_REASONS,
  stockStatusFor,
  type AuthUser,
  type MovementView,
  type Paginated,
} from '@pulso/contracts';
import type { BloodStock, Prisma, StockMovement } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMovementDto, MovementsQueryDto } from './dto/stock.dto';
import { minimumBalanceSince } from './stock-history';

/** Tolerância para relógios levemente adiantados no cliente. */
export const FUTURE_TOLERANCE_MS = 60_000;
/** Movimentações retroativas aceitas até este limite. */
export const MAX_BACKDATE_DAYS = 30;

const UNKNOWN_RESPONSIBLE = 'Responsável não identificado';

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Registra uma entrada ou saída (RN10: o estoque só muda por movimentações).
   * A linha do tipo fica bloqueada durante a transação, então duas saídas
   * simultâneas não deixam o saldo negativo.
   */
  async create(actor: AuthUser, dto: CreateMovementDto, requestId?: string): Promise<MovementView> {
    if (MOVEMENT_REASONS[dto.reason].type !== dto.type) {
      throw new AppException(
        400,
        'REASON_TYPE_MISMATCH',
        'O motivo escolhido não corresponde ao tipo da movimentação.',
        undefined,
        [
          {
            field: 'reason',
            message:
              dto.type === 'IN' ? 'Escolha um motivo de entrada.' : 'Escolha um motivo de saída.',
          },
        ],
      );
    }
    const now = Date.now();
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date(now);
    if (occurredAt.getTime() > now + FUTURE_TOLERANCE_MS) {
      throw new AppException(
        400,
        'INVALID_OCCURRED_AT',
        'A data da movimentação não pode ser futura.',
        undefined,
        [{ field: 'occurredAt', message: 'A data não pode ser futura.' }],
      );
    }
    if (occurredAt.getTime() < now - MAX_BACKDATE_DAYS * 86_400_000) {
      throw new AppException(
        400,
        'INVALID_OCCURRED_AT',
        `Registre movimentações de até ${MAX_BACKDATE_DAYS} dias atrás.`,
        undefined,
        [
          {
            field: 'occurredAt',
            message: `Informe uma data dos últimos ${MAX_BACKDATE_DAYS} dias.`,
          },
        ],
      );
    }

    const label = BLOOD_TYPE_LABELS[dto.bloodType];
    const movement = await this.prisma.$transaction(async (tx) => {
      const [stock] = await tx.$queryRaw<BloodStock[]>`
        SELECT "bloodType", "quantity", "minimum", "ideal"
          FROM "blood_stock" WHERE "bloodType" = ${dto.bloodType}::"BloodType" FOR UPDATE`;
      if (!stock) {
        throw new AppException(
          404,
          'STOCK_NOT_FOUND',
          `O tipo ${label} não está cadastrado no estoque.`,
        );
      }

      if (dto.type === 'OUT') {
        if (dto.quantity > stock.quantity) {
          throw new AppException(
            422,
            'INSUFFICIENT_STOCK',
            `Saída maior que o estoque atual de ${label} (${stock.quantity} bolsas).`,
          );
        }
        // Saída retroativa: o saldo não pode ter ficado negativo em nenhum momento desde então.
        const later = await tx.stockMovement.findMany({
          where: { bloodType: dto.bloodType, occurredAt: { gt: occurredAt } },
          select: { type: true, quantity: true },
          orderBy: { occurredAt: 'desc' },
        });
        const minimum = minimumBalanceSince(stock.quantity, later);
        if (dto.quantity > minimum) {
          throw new AppException(
            422,
            'INSUFFICIENT_STOCK',
            `Na data informada, o saldo de ${label} era menor que a saída (mínimo de ${minimum} bolsas no período).`,
          );
        }
      }

      const quantity = stock.quantity + (dto.type === 'IN' ? dto.quantity : -dto.quantity);
      await tx.bloodStock.update({ where: { bloodType: dto.bloodType }, data: { quantity } });
      const created = await tx.stockMovement.create({
        data: {
          bloodType: dto.bloodType,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          notes: dto.notes ? dto.notes : null,
          occurredAt,
          responsibleId: actor.id,
          responsibleName: actor.name || UNKNOWN_RESPONSIBLE,
          balanceAfter: quantity,
        },
      });

      const previousStatus = stockStatusFor(stock.quantity, stock.minimum, stock.ideal);
      const status = stockStatusFor(quantity, stock.minimum, stock.ideal);
      if (status !== previousStatus) {
        await this.outbox.enqueue(
          tx,
          EVENTS.STOCK_LEVEL_CHANGED,
          { bloodType: dto.bloodType, previousStatus, status, quantity },
          requestId,
        );
      }
      await this.audit.record(
        {
          actor,
          action: 'stock.movement_created',
          entity: 'blood_stock_movement',
          entityId: created.id,
          metadata: {
            bloodType: dto.bloodType,
            type: dto.type,
            quantity: dto.quantity,
            reason: dto.reason,
          },
          requestId,
        },
        tx,
      );
      return created;
    });
    return toMovementView(movement);
  }

  async list(query: MovementsQueryDto): Promise<Paginated<MovementView>> {
    const { skip, take, page, pageSize } = pageParams(query);
    const occurredAt: Prisma.DateTimeFilter = {};
    try {
      if (query.from) occurredAt.gte = localDayRange(query.from, query.from).start;
      if (query.to) occurredAt.lte = localDayRange(query.to, query.to).end;
    } catch {
      throw new AppException(400, 'INVALID_PERIOD', 'Informe datas válidas no formato AAAA-MM-DD.');
    }
    if (occurredAt.gte && occurredAt.lte && occurredAt.gte > occurredAt.lte) {
      throw new AppException(400, 'INVALID_PERIOD', 'A data inicial deve ser anterior à final.');
    }
    const where: Prisma.StockMovementWhereInput = {
      ...(query.bloodType ? { bloodType: query.bloodType } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(occurredAt.gte || occurredAt.lte ? { occurredAt } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paginated(rows.map(toMovementView), total, page, pageSize);
  }
}

export function toMovementView(row: StockMovement): MovementView {
  return {
    id: row.id,
    bloodType: row.bloodType,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    notes: row.notes,
    occurredAt: row.occurredAt.toISOString(),
    responsibleName: row.responsibleName,
    balanceAfter: row.balanceAfter,
    createdAt: row.createdAt.toISOString(),
  };
}

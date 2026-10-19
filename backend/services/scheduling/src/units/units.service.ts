import { Injectable } from '@nestjs/common';
import { AppException, AuditService, OutboxService } from '@pulso/common';
import {
  EVENTS,
  hasPermission,
  type AuthUser,
  type ScheduleBlockView,
  type ScheduleRuleView,
  type UnitView,
} from '@pulso/contracts';
import type { HealthUnit, ScheduleBlock } from '../../generated/prisma';
import { toUnitView } from '../appointments/appointment.mapper';
import { releaseSlot } from '../appointments/slot-ledger';
import { validateRules } from '../domain/schedule';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateScheduleBlockDto,
  ReplaceScheduleRulesDto,
  UnitInputDto,
  UpdateUnitDto,
} from './dto/units.dto';

export function canManageUnits(user: AuthUser | undefined): boolean {
  return !!user && hasPermission(user.role, 'unit:manage');
}

function toBlockView(block: ScheduleBlock): ScheduleBlockView {
  return {
    id: block.id,
    startsAt: block.startsAt.toISOString(),
    endsAt: block.endsAt.toISOString(),
    reason: block.reason,
    createdAt: block.createdAt.toISOString(),
  };
}

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async list(includeInactive: boolean): Promise<UnitView[]> {
    const units = await this.prisma.healthUnit.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    return units.map(toUnitView);
  }

  async get(id: string, includeInactive: boolean): Promise<UnitView> {
    return toUnitView(await this.find(id, includeInactive));
  }

  /** Unidade existente (e ativa, salvo quando `includeInactive`). */
  async find(id: string, includeInactive = false): Promise<HealthUnit> {
    const unit = await this.prisma.healthUnit.findUnique({ where: { id } });
    if (!unit || (!includeInactive && unit.status !== 'ACTIVE')) {
      throw new AppException(404, 'UNIT_NOT_FOUND', 'Unidade não encontrada.');
    }
    return unit;
  }

  async create(actor: AuthUser, dto: UnitInputDto, requestId?: string): Promise<UnitView> {
    const unit = await this.prisma.$transaction(async (tx) => {
      const created = await tx.healthUnit.create({
        data: { ...dto, zipCode: dto.zipCode ?? null },
      });
      await this.audit.record(
        { actor, action: 'unit.created', entity: 'unit', entityId: created.id, requestId },
        tx,
      );
      return created;
    });
    return toUnitView(unit);
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateUnitDto,
    requestId?: string,
  ): Promise<UnitView> {
    await this.find(id, true);
    const unit = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.healthUnit.update({ where: { id }, data: dto });
      await this.audit.record(
        {
          actor,
          action: 'unit.updated',
          entity: 'unit',
          entityId: id,
          metadata: { fields: Object.keys(dto), status: dto.status },
          requestId,
        },
        tx,
      );
      return updated;
    });
    return toUnitView(unit);
  }

  async rules(unitId: string): Promise<ScheduleRuleView[]> {
    await this.find(unitId, true);
    const rules = await this.prisma.scheduleRule.findMany({
      where: { unitId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return rules.map(({ unitId: _unitId, ...rule }) => rule);
  }

  /**
   * Substitui a grade semanal. Vagas já materializadas (com reservas) mantêm a
   * capacidade com que foram criadas; os agendamentos existentes não mudam.
   */
  async replaceRules(
    actor: AuthUser,
    unitId: string,
    dto: ReplaceScheduleRulesDto,
    requestId?: string,
  ): Promise<ScheduleRuleView[]> {
    await this.find(unitId, true);
    const issues = validateRules(dto.rules);
    if (issues.length > 0) {
      throw new AppException(
        400,
        'INVALID_SCHEDULE_RULES',
        'Alguns períodos da grade precisam de correção.',
        'Grade inválida',
        issues.map((issue) => ({
          field: `rules.${issue.index}.${issue.field}`,
          message: issue.message,
        })),
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.scheduleRule.deleteMany({ where: { unitId } });
      await tx.scheduleRule.createMany({ data: dto.rules.map((rule) => ({ ...rule, unitId })) });
      await this.audit.record(
        {
          actor,
          action: 'unit.schedule_rules_replaced',
          entity: 'unit',
          entityId: unitId,
          metadata: { rules: dto.rules.length },
          requestId,
        },
        tx,
      );
    });
    return this.rules(unitId);
  }

  async blocks(unitId: string): Promise<ScheduleBlockView[]> {
    await this.find(unitId, true);
    const blocks = await this.prisma.scheduleBlock.findMany({
      where: { unitId, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    });
    return blocks.map(toBlockView);
  }

  /**
   * Bloqueia um período (RF53): novos agendamentos ficam impedidos e os já
   * marcados no período são cancelados pela unidade, com aviso ao doador
   * (evento scheduling.appointment.cancelled) e a vaga liberada.
   */
  async createBlock(
    actor: AuthUser,
    unitId: string,
    dto: CreateScheduleBlockDto,
    requestId?: string,
  ): Promise<ScheduleBlockView> {
    await this.find(unitId, true);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) {
      throw new AppException(
        400,
        'INVALID_PERIOD',
        'O fim do bloqueio precisa ser depois do início.',
        undefined,
        [{ field: 'endsAt', message: 'O fim precisa ser depois do início.' }],
      );
    }
    if (endsAt <= new Date()) {
      throw new AppException(
        400,
        'INVALID_PERIOD',
        'O bloqueio precisa terminar no futuro.',
        undefined,
        [{ field: 'endsAt', message: 'O bloqueio precisa terminar no futuro.' }],
      );
    }
    const { block, cancelled } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.scheduleBlock.create({
        data: { unitId, startsAt, endsAt, reason: dto.reason, createdById: actor.id },
      });
      const affected = await tx.appointment.findMany({
        where: {
          unitId,
          status: { in: ['BOOKED', 'CONFIRMED'] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        include: { unit: { select: { name: true } } },
      });
      let cancelledCount = 0;
      for (const appointment of affected) {
        const { count } = await tx.appointment.updateMany({
          where: { id: appointment.id, status: { in: ['BOOKED', 'CONFIRMED'] } },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: 'STAFF',
            cancelReason: `Período bloqueado pela unidade: ${dto.reason}`,
          },
        });
        if (count === 0) continue;
        cancelledCount += 1;
        await releaseSlot(tx, appointment.slotId);
        await this.outbox.enqueue(
          tx,
          EVENTS.APPOINTMENT_CANCELLED,
          {
            appointmentId: appointment.id,
            donorId: appointment.donorId,
            unitName: appointment.unit.name,
            startsAt: appointment.startsAt.toISOString(),
            cancelledBy: 'STAFF',
          },
          requestId,
        );
        await this.audit.record(
          {
            actor,
            action: 'appointment.cancelled',
            entity: 'appointment',
            entityId: appointment.id,
            metadata: { cancelledBy: 'STAFF', reason: 'unit_blocked', blockId: created.id },
            requestId,
          },
          tx,
        );
      }
      await this.audit.record(
        {
          actor,
          action: 'unit.block_created',
          entity: 'schedule_block',
          entityId: created.id,
          metadata: { unitId, cancelledAppointments: cancelledCount },
          requestId,
        },
        tx,
      );
      return { block: created, cancelled: cancelledCount };
    });
    return { ...toBlockView(block), cancelledAppointments: cancelled };
  }

  async deleteBlock(
    actor: AuthUser,
    unitId: string,
    blockId: string,
    requestId?: string,
  ): Promise<void> {
    const block = await this.prisma.scheduleBlock.findUnique({ where: { id: blockId } });
    if (!block || block.unitId !== unitId) {
      throw new AppException(404, 'BLOCK_NOT_FOUND', 'Bloqueio não encontrado.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.scheduleBlock.delete({ where: { id: blockId } });
      await this.audit.record(
        {
          actor,
          action: 'unit.block_deleted',
          entity: 'schedule_block',
          entityId: blockId,
          metadata: { unitId },
          requestId,
        },
        tx,
      );
    });
  }
}

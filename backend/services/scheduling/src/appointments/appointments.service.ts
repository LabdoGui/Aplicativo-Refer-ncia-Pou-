import { Injectable } from '@nestjs/common';
import { AppException, AuditService, humanCode, OutboxService } from '@pulso/common';
import {
  EVENTS,
  SCHEDULING_POLICY,
  type AppointmentView,
  type AuthUser,
  type CancelledBy,
} from '@pulso/contracts';
import type { HealthUnit, Prisma } from '../../generated/prisma';
import { CampaignsService } from '../campaigns/campaigns.service';
import {
  bookingWindow,
  canChange,
  findSlotForStart,
  isBlocked,
  type GeneratedSlot,
} from '../domain/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  APPOINTMENT_INCLUDE,
  toAppointmentView,
  type AppointmentWithRelations,
} from './appointment.mapper';
import type {
  CancelAppointmentDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
} from './dto/appointments.dto';
import {
  isActiveAppointmentConflict,
  isTransientConflict,
  releaseSlot,
  reserveSlot,
} from './slot-ledger';

/** Transações de reserva esperam a vez na mesma vaga: limites mais folgados que o padrão. */
const BOOKING_TX = { maxWait: 10_000, timeout: 15_000 } as const;

const ACTIVE_APPOINTMENT = () =>
  new AppException(
    409,
    'ACTIVE_APPOINTMENT_EXISTS',
    'Você já tem um agendamento ativo. Cancele ou reagende antes de marcar outro.',
  );

interface ResolvedSlot {
  unit: HealthUnit;
  slot: GeneratedSlot;
}

interface CancelOptions {
  cancelledBy: CancelledBy;
  reason: string | null;
  actor: AuthUser;
  requestId?: string;
  /** No reagendamento o evento é "rescheduled", não "cancelled". */
  emitEvent: boolean;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async book(
    donor: AuthUser,
    dto: CreateAppointmentDto,
    requestId?: string,
  ): Promise<AppointmentView> {
    const startsAt = new Date(dto.startsAt);
    const { unit, slot } = await this.resolveSlot(dto.unitId, startsAt);
    const campaignId = await this.campaigns.resolveForBooking(
      dto.campaignId,
      unit.id,
      startsAt,
      unit.timezone,
    );
    await this.assertNoActiveAppointment(donor.id);

    const created = await this.runBooking(async (tx) => {
      const appointment = await this.createAppointment(tx, donor.id, unit, slot, campaignId, null);
      await this.outbox.enqueue(
        tx,
        EVENTS.APPOINTMENT_BOOKED,
        {
          appointmentId: appointment.id,
          code: appointment.code,
          donorId: donor.id,
          unitId: unit.id,
          unitName: unit.name,
          startsAt: appointment.startsAt.toISOString(),
          campaignId,
        },
        requestId,
      );
      await this.audit.record(
        {
          actor: donor,
          action: 'appointment.booked',
          entity: 'appointment',
          entityId: appointment.id,
          metadata: { unitId: unit.id, campaignId },
          requestId,
        },
        tx,
      );
      return appointment;
    });
    return toAppointmentView(created);
  }

  async listMine(donorId: string): Promise<AppointmentView[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: { donorId },
      include: APPOINTMENT_INCLUDE,
      orderBy: { startsAt: 'desc' },
    });
    const now = new Date();
    return appointments.map((appointment) => toAppointmentView(appointment, now));
  }

  async getMine(donorId: string, id: string): Promise<AppointmentView> {
    return toAppointmentView(await this.findOwn(donorId, id));
  }

  async cancel(
    donor: AuthUser,
    id: string,
    dto: CancelAppointmentDto,
    requestId?: string,
  ): Promise<AppointmentView> {
    const appointment = await this.findOwn(donor.id, id);
    this.assertDonorCanChange(appointment);
    await this.prisma.$transaction((tx) =>
      this.cancelInTx(tx, appointment, {
        cancelledBy: 'DONOR',
        reason: dto.reason || null,
        actor: donor,
        requestId,
        emitEvent: true,
      }),
    );
    return this.getMine(donor.id, id);
  }

  async reschedule(
    donor: AuthUser,
    id: string,
    dto: RescheduleAppointmentDto,
    requestId?: string,
  ): Promise<AppointmentView> {
    const previous = await this.findOwn(donor.id, id);
    this.assertDonorCanChange(previous);
    const startsAt = new Date(dto.startsAt);
    if (previous.unitId === dto.unitId && previous.startsAt.getTime() === startsAt.getTime()) {
      throw new AppException(422, 'SAME_SLOT', 'Escolha um horário diferente do atual.');
    }
    const { unit, slot } = await this.resolveSlot(dto.unitId, startsAt);
    // A campanha acompanha o reagendamento só se continuar valendo para a nova data/unidade.
    const campaignId = await this.campaigns.resolveForBooking(
      previous.campaignId,
      unit.id,
      startsAt,
      unit.timezone,
      true,
    );

    const created = await this.runBooking(async (tx) => {
      await this.cancelInTx(tx, previous, {
        cancelledBy: 'DONOR',
        reason: 'Reagendado pelo doador',
        actor: donor,
        requestId,
        emitEvent: false,
      });
      const appointment = await this.createAppointment(
        tx,
        donor.id,
        unit,
        slot,
        campaignId,
        previous.id,
      );
      await this.outbox.enqueue(
        tx,
        EVENTS.APPOINTMENT_RESCHEDULED,
        {
          appointmentId: appointment.id,
          previousAppointmentId: previous.id,
          donorId: donor.id,
          unitName: unit.name,
          startsAt: appointment.startsAt.toISOString(),
        },
        requestId,
      );
      await this.audit.record(
        {
          actor: donor,
          action: 'appointment.rescheduled',
          entity: 'appointment',
          entityId: appointment.id,
          metadata: { previousAppointmentId: previous.id, unitId: unit.id, campaignId },
          requestId,
        },
        tx,
      );
      return appointment;
    });
    return toAppointmentView(created);
  }

  /** Cancelamento pela unidade/administração: vale a qualquer momento antes do atendimento. */
  async cancelByStaff(
    actor: AuthUser,
    id: string,
    reason: string,
    requestId?: string,
  ): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) {
      throw new AppException(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    }
    if (appointment.status !== 'BOOKED' && appointment.status !== 'CONFIRMED') {
      throw new AppException(
        409,
        'INVALID_STATUS',
        'Este agendamento não pode mais ser cancelado.',
      );
    }
    await this.prisma.$transaction((tx) =>
      this.cancelInTx(tx, appointment, {
        cancelledBy: 'STAFF',
        reason,
        actor,
        requestId,
        emitEvent: true,
      }),
    );
  }

  /**
   * Cancela (com UPDATE condicional, contra alterações concorrentes), libera a
   * vaga e registra evento e auditoria.
   */
  private async cancelInTx(
    tx: Prisma.TransactionClient,
    appointment: AppointmentWithRelations,
    options: CancelOptions,
  ): Promise<void> {
    const { count } = await tx.appointment.updateMany({
      where: { id: appointment.id, status: { in: ['BOOKED', 'CONFIRMED'] } },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: options.cancelledBy,
        cancelReason: options.reason,
      },
    });
    if (count === 0) {
      throw new AppException(
        409,
        'INVALID_STATUS',
        'Este agendamento mudou de situação. Atualize a página e tente novamente.',
      );
    }
    await releaseSlot(tx, appointment.slotId);
    if (options.emitEvent) {
      await this.outbox.enqueue(
        tx,
        EVENTS.APPOINTMENT_CANCELLED,
        {
          appointmentId: appointment.id,
          donorId: appointment.donorId,
          unitName: appointment.unit.name,
          startsAt: appointment.startsAt.toISOString(),
          cancelledBy: options.cancelledBy,
        },
        options.requestId,
      );
    }
    await this.audit.record(
      {
        actor: options.actor,
        action: 'appointment.cancelled',
        entity: 'appointment',
        entityId: appointment.id,
        metadata: { cancelledBy: options.cancelledBy },
        requestId: options.requestId,
      },
      tx,
    );
  }

  /** Valida unidade, janela (RN05), alinhamento à grade e bloqueios (RN02). */
  private async resolveSlot(unitId: string, startsAt: Date): Promise<ResolvedSlot> {
    const unit = await this.prisma.healthUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new AppException(404, 'UNIT_NOT_FOUND', 'Unidade não encontrada.');
    if (unit.status !== 'ACTIVE') {
      throw new AppException(
        422,
        'UNIT_UNAVAILABLE',
        'Esta unidade não está recebendo agendamentos no momento. Escolha outra.',
      );
    }
    const window = bookingWindow(new Date(), unit.timezone);
    if (startsAt < window.earliest) {
      throw new AppException(
        422,
        'TOO_SOON',
        `Escolha um horário com pelo menos ${SCHEDULING_POLICY.minLeadMinutes / 60} horas de antecedência.`,
      );
    }
    if (startsAt > window.latest) {
      throw new AppException(
        422,
        'TOO_FAR',
        `É possível agendar com até ${SCHEDULING_POLICY.maxDaysAhead} dias de antecedência.`,
      );
    }
    const rules = await this.prisma.scheduleRule.findMany({ where: { unitId, active: true } });
    const slot = findSlotForStart(rules, startsAt, unit.timezone);
    if (!slot) {
      throw new AppException(
        422,
        'INVALID_SLOT',
        'Este horário não existe na agenda desta unidade.',
      );
    }
    const blocks = await this.prisma.scheduleBlock.findMany({
      where: { unitId, startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } },
    });
    if (isBlocked(slot, blocks)) {
      throw new AppException(
        422,
        'SLOT_BLOCKED',
        'Este horário foi bloqueado pela unidade. Escolha outro.',
      );
    }
    return { unit, slot };
  }

  private async createAppointment(
    tx: Prisma.TransactionClient,
    donorId: string,
    unit: HealthUnit,
    slot: GeneratedSlot,
    campaignId: string | null,
    rescheduledFromId: string | null,
  ): Promise<AppointmentWithRelations> {
    const slotId = await reserveSlot(tx, unit.id, slot);
    return tx.appointment.create({
      data: {
        code: await this.uniqueCode(tx),
        donorId,
        unitId: unit.id,
        slotId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        campaignId,
        rescheduledFromId,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  /** Executa a transação de reserva, traduzindo conflitos em mensagens amigáveis. */
  private async runBooking<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, BOOKING_TX);
    } catch (error) {
      if (isActiveAppointmentConflict(error)) throw ACTIVE_APPOINTMENT();
      if (isTransientConflict(error)) {
        throw new AppException(
          409,
          'BOOKING_CONFLICT',
          'Muitas pessoas tentaram agendar ao mesmo tempo. Tente novamente.',
        );
      }
      throw error;
    }
  }

  /** Verificação antecipada (mensagem clara); o índice único parcial garante a regra (RN03). */
  private async assertNoActiveAppointment(donorId: string): Promise<void> {
    const active = await this.prisma.appointment.findFirst({
      where: { donorId, status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] } },
      select: { id: true },
    });
    if (active) throw ACTIVE_APPOINTMENT();
  }

  private assertDonorCanChange(appointment: AppointmentWithRelations): void {
    if (canChange(appointment.status, appointment.startsAt, new Date())) return;
    if (appointment.status !== 'BOOKED' && appointment.status !== 'CONFIRMED') {
      throw new AppException(409, 'INVALID_STATUS', 'Este agendamento não pode mais ser alterado.');
    }
    const phone = appointment.unit.phone ? ` pelo telefone ${appointment.unit.phone}` : '';
    throw new AppException(
      422,
      'CHANGE_WINDOW_CLOSED',
      `Cancelamentos e reagendamentos pelo app vão até ${SCHEDULING_POLICY.cancelMinHours} horas antes do horário. Fale com a unidade${phone}.`,
    );
  }

  /** Doador só enxerga os próprios agendamentos (os de outra pessoa respondem 404). */
  private async findOwn(donorId: string, id: string): Promise<AppointmentWithRelations> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, donorId },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) {
      throw new AppException(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    }
    return appointment;
  }

  private async uniqueCode(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = humanCode('AG');
      const taken = await tx.appointment.findUnique({ where: { code }, select: { id: true } });
      if (!taken) return code;
    }
    throw new Error('Não foi possível gerar um código de agendamento único');
  }
}

import { Injectable } from '@nestjs/common';
import {
  AppException,
  AuditService,
  FieldEncryption,
  OutboxService,
  assertUnitScope,
  todayLocal,
  toLocalDate,
} from '@pulso/common';
import {
  EVENTS,
  type AttendanceStaffView,
  type AuthUser,
  type ScreeningFieldView,
  type SharedPreScreeningView,
} from '@pulso/contracts';
import { Prisma } from '../../generated/prisma';
import { PreScreeningService } from '../pre-screening/pre-screening.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulingClient } from '../scheduling/scheduling.client';
import type { ProfessionalScreeningDto } from './dto/attendance.dto';
import { validateFieldValues } from './field-validation';
import { toAttendanceStaffView, toFieldDefinition, toFieldView } from './mappers';

const DONATION_SUMMARY = { select: { id: true, code: true, status: true } } as const;

@Injectable()
export class AttendancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryption,
    private readonly scheduling: SchedulingClient,
    private readonly preScreenings: PreScreeningService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async activeFields(): Promise<ScreeningFieldView[]> {
    const fields = await this.prisma.professionalScreeningField.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { label: 'asc' }],
    });
    return fields.map(toFieldView);
  }

  /** Atendimento do agendamento, ou null se a triagem ainda não foi registrada. */
  async byAppointment(
    actor: AuthUser,
    appointmentId: string,
    requestId?: string,
  ): Promise<AttendanceStaffView | null> {
    const attendance = await this.prisma.professionalScreening.findUnique({
      where: { appointmentId },
      include: { donation: DONATION_SUMMARY },
    });
    if (attendance) {
      assertUnitScope(actor, attendance.unitId);
      const view = toAttendanceStaffView(attendance);
      // Dado de saúde só durante o atendimento (ou no mesmo dia em que terminou),
      // com leitura registrada; atendimentos antigos mostram apenas que terminaram.
      const open =
        attendance.completedAt === null || toLocalDate(attendance.completedAt) === todayLocal();
      if (!open) return { ...view, result: null, professionalName: null };
      await this.audit.record({
        actor,
        action: 'attendance.viewed_by_staff',
        entity: 'attendance',
        entityId: attendance.id,
        metadata: { appointmentId },
        requestId,
      });
      return view;
    }
    const appointment = await this.scheduling.appointment(appointmentId, requestId);
    assertUnitScope(actor, appointment.unitId);
    return null;
  }

  /**
   * Pré-triagem compartilhada pelo doador do agendamento (acesso auditado). Só
   * enquanto o atendimento está em aberto: no dia do agendamento ou depois do
   * check-in, e antes de o atendimento terminar.
   */
  async sharedPreScreening(
    actor: AuthUser,
    appointmentId: string,
    requestId?: string,
  ): Promise<SharedPreScreeningView | null> {
    const appointment = await this.scheduling.appointment(appointmentId, requestId);
    assertUnitScope(actor, appointment.unitId);
    const scheduledToday =
      (appointment.status === 'BOOKED' || appointment.status === 'CONFIRMED') &&
      toLocalDate(appointment.startsAt) === todayLocal();
    const open = appointment.status === 'CHECKED_IN' || scheduledToday;
    const finished = await this.prisma.professionalScreening.findFirst({
      where: { appointmentId, completedAt: { not: null } },
      select: { id: true },
    });
    if (!open || finished) {
      throw new AppException(
        409,
        'PRESCREENING_NOT_AVAILABLE',
        'A pré-triagem compartilhada fica disponível só no dia do atendimento, enquanto ele está em aberto.',
      );
    }
    const view = await this.preScreenings.sharedForStaff(appointment.donorId, appointment.startsAt);
    if (view) {
      await this.audit.record({
        actor,
        action: 'prescreening.viewed_by_staff',
        entity: 'pre_screening',
        entityId: view.id,
        metadata: { appointmentId },
        requestId,
      });
    }
    return view;
  }

  async record(
    actor: AuthUser,
    dto: ProfessionalScreeningDto,
    requestId?: string,
  ): Promise<AttendanceStaffView> {
    const appointment = await this.scheduling.appointment(dto.appointmentId, requestId);
    assertUnitScope(actor, appointment.unitId);
    if (appointment.status !== 'CHECKED_IN') {
      throw new AppException(
        422,
        'APPOINTMENT_NOT_CHECKED_IN',
        'Faça o check-in do doador antes de registrar a triagem.',
      );
    }
    const existing = await this.prisma.professionalScreening.findUnique({
      where: { appointmentId: dto.appointmentId },
      select: { id: true },
    });
    if (existing) throw this.alreadyRecorded();

    const fields = await this.prisma.professionalScreeningField.findMany({
      where: { active: true },
    });
    const { values, errors } = validateFieldValues(fields.map(toFieldDefinition), dto.values);
    if (errors.length > 0) {
      throw new AppException(
        400,
        'VALIDATION_ERROR',
        'Alguns campos da triagem precisam de correção.',
        'Dados inválidos',
        errors,
      );
    }

    const now = new Date();
    // Sem aptidão, não há doação a registrar: o atendimento termina aqui.
    const completesNow = dto.result !== 'FIT';
    try {
      const attendance = await this.prisma.$transaction(async (tx) => {
        const created = await tx.professionalScreening.create({
          data: {
            appointmentId: appointment.id,
            donorId: appointment.donorId,
            unitId: appointment.unitId,
            unitName: appointment.unitName,
            campaignId: appointment.campaignId,
            campaignTitle: appointment.campaignTitle,
            professionalId: actor.id,
            professionalName: actor.name,
            result: dto.result,
            valuesEncrypted: this.encryption.encryptJson(values),
            notesEncrypted: dto.notes ? this.encryption.encrypt(dto.notes) : null,
            completedAt: completesNow ? now : null,
          },
          include: { donation: DONATION_SUMMARY },
        });
        if (completesNow) {
          await this.outbox.enqueue(
            tx,
            EVENTS.ATTENDANCE_COMPLETED,
            {
              attendanceId: created.id,
              appointmentId: created.appointmentId,
              donorId: created.donorId,
              unitId: created.unitId,
              donationCompleted: false,
              donationId: null,
              campaignId: created.campaignId,
              occurredAt: now.toISOString(),
            },
            requestId,
          );
        }
        // Sem o resultado: a trilha registra o fato, não o dado de saúde.
        await this.audit.record(
          {
            actor,
            action: 'attendance.screening_recorded',
            entity: 'attendance',
            entityId: created.id,
            metadata: { appointmentId: appointment.id },
            requestId,
          },
          tx,
        );
        return created;
      });
      return toAttendanceStaffView(attendance);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.alreadyRecorded();
      }
      throw error;
    }
  }

  private alreadyRecorded(): AppException {
    return new AppException(
      409,
      'ATTENDANCE_EXISTS',
      'A triagem deste agendamento já foi registrada. Atualize a página.',
    );
  }
}

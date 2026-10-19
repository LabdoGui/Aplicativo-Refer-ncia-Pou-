import { Injectable } from '@nestjs/common';
import {
  AppException,
  AuditService,
  FieldEncryption,
  OutboxService,
  assertUnitScope,
  humanCode,
  localDayRange,
  pageParams,
  paginated,
  todayLocal,
} from '@pulso/common';
import {
  EVENTS,
  type AdminDonationItem,
  type AttendanceStaffView,
  type AuthUser,
  type DonorAttendanceView,
  type EligibilityView,
  type Paginated,
} from '@pulso/contracts';
import { Prisma } from '../../generated/prisma';
import { toAttendanceStaffView } from '../attendances/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { AdminDonationsQueryDto, RecordDonationDto } from './dto/donation.dto';
import { nextEligibleDate } from './eligibility';

const DONOR_ATTENDANCE_INCLUDE = {
  donation: { select: { id: true, code: true, status: true, volumeMl: true } },
  documents: { select: { id: true, type: true }, orderBy: { issuedAt: 'asc' } },
} as const;

type DonorAttendanceRow = Prisma.ProfessionalScreeningGetPayload<{
  include: typeof DONOR_ATTENDANCE_INCLUDE;
}>;

@Injectable()
export class DonationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryption,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /** Registra a doação de um atendimento com triagem apta e finaliza o atendimento. */
  async record(
    actor: AuthUser,
    dto: RecordDonationDto,
    requestId?: string,
  ): Promise<AttendanceStaffView> {
    // Doação concluída tem volume coletado; 0 mL só faz sentido em "não concluída".
    if (dto.status === 'COMPLETED' && dto.volumeMl <= 0) {
      throw new AppException(
        400,
        'VALIDATION_ERROR',
        'Informe o volume coletado.',
        'Dados inválidos',
        [
          {
            field: 'volumeMl',
            message: 'Para uma doação concluída, informe um volume maior que zero.',
          },
        ],
      );
    }
    const attendance = await this.prisma.professionalScreening.findUnique({
      where: { id: dto.attendanceId },
      include: { donation: { select: { id: true } } },
    });
    if (!attendance) {
      throw new AppException(404, 'ATTENDANCE_NOT_FOUND', 'Atendimento não encontrado.');
    }
    assertUnitScope(actor, attendance.unitId);
    if (attendance.donation) throw this.donationExists();
    if (attendance.result !== 'FIT') {
      throw new AppException(
        422,
        'SCREENING_NOT_FIT',
        'A doação só pode ser registrada quando a triagem foi concluída como apta.',
      );
    }
    if (attendance.completedAt) {
      throw new AppException(409, 'ATTENDANCE_COMPLETED', 'Este atendimento já foi finalizado.');
    }

    const settings = await this.settings.get();
    const now = new Date();
    const completed = dto.status === 'COMPLETED';
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const donation = await tx.donation.create({
          data: {
            code: await this.uniqueCode(tx),
            attendanceId: attendance.id,
            donorId: attendance.donorId,
            unitId: attendance.unitId,
            unitName: attendance.unitName,
            campaignId: attendance.campaignId,
            professionalId: actor.id,
            bloodType: dto.bloodType,
            volumeMl: dto.volumeMl,
            status: dto.status,
            notesEncrypted: dto.notes ? this.encryption.encrypt(dto.notes) : null,
            occurredAt: now,
            nextEligibleAt: completed
              ? new Date(`${nextEligibleDate(now, settings.donationIntervalDays)}T00:00:00Z`)
              : null,
          },
        });
        const finished = await tx.professionalScreening.update({
          where: { id: attendance.id },
          data: { completedAt: now },
          include: { donation: { select: { id: true, code: true, status: true } } },
        });
        if (completed) {
          await this.outbox.enqueue(
            tx,
            EVENTS.DONATION_COMPLETED,
            {
              donationId: donation.id,
              code: donation.code,
              donorId: donation.donorId,
              unitId: donation.unitId,
              attendanceId: attendance.id,
              campaignId: donation.campaignId,
              occurredAt: now.toISOString(),
            },
            requestId,
          );
        }
        await this.outbox.enqueue(
          tx,
          EVENTS.ATTENDANCE_COMPLETED,
          {
            attendanceId: attendance.id,
            appointmentId: attendance.appointmentId,
            donorId: attendance.donorId,
            unitId: attendance.unitId,
            donationCompleted: completed,
            donationId: donation.id,
            campaignId: attendance.campaignId,
            occurredAt: now.toISOString(),
          },
          requestId,
        );
        await this.audit.record(
          {
            actor,
            action: 'donation.recorded',
            entity: 'donation',
            entityId: donation.id,
            metadata: { attendanceId: attendance.id, status: dto.status },
            requestId,
          },
          tx,
        );
        return finished;
      });
      return toAttendanceStaffView(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.donationExists();
      }
      throw error;
    }
  }

  /** Atendimentos finalizados do doador (sem resultado nem valores da triagem). */
  async history(actor: AuthUser): Promise<DonorAttendanceView[]> {
    const rows = await this.prisma.professionalScreening.findMany({
      where: { donorId: actor.id, completedAt: { not: null } },
      include: DONOR_ATTENDANCE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDonorAttendanceView);
  }

  async attendance(actor: AuthUser, attendanceId: string): Promise<DonorAttendanceView> {
    const row = await this.prisma.professionalScreening.findUnique({
      where: { id: attendanceId },
      include: DONOR_ATTENDANCE_INCLUDE,
    });
    if (!row || row.donorId !== actor.id || !row.completedAt) {
      throw new AppException(404, 'ATTENDANCE_NOT_FOUND', 'Atendimento não encontrado.');
    }
    return toDonorAttendanceView(row);
  }

  /**
   * Data informativa da próxima doação (RN04), calculada com o intervalo vigente
   * a partir da última doação registrada (se a instituição mudar o parâmetro, a
   * data acompanha). Se a pré-triagem válida mais recente indicar uma data
   * posterior (por exemplo, pela última doação autodeclarada), vale essa.
   */
  async eligibility(actor: AuthUser): Promise<EligibilityView> {
    const settings = await this.settings.get();
    const [last, preScreening] = await Promise.all([
      this.prisma.donation.findFirst({
        where: { donorId: actor.id, status: 'COMPLETED' },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      }),
      this.prisma.preScreening.findFirst({
        where: { donorId: actor.id, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { waitUntil: true },
      }),
    ]);
    const fromDonation = last
      ? nextEligibleDate(last.occurredAt, settings.donationIntervalDays)
      : null;
    const fromPreScreening = preScreening?.waitUntil
      ? preScreening.waitUntil.toISOString().slice(0, 10)
      : null;
    const usePreScreening =
      fromPreScreening !== null && (fromDonation === null || fromPreScreening > fromDonation);
    return {
      lastDonationAt: last?.occurredAt.toISOString() ?? null,
      nextEligibleAt: usePreScreening ? fromPreScreening : fromDonation,
      source: usePreScreening ? 'PRE_SCREENING' : fromDonation ? 'DONATION' : null,
      intervalDays: settings.donationIntervalDays,
      validationStatus: settings.intervalValidationStatus,
    };
  }

  async adminList(query: AdminDonationsQueryDto): Promise<Paginated<AdminDonationItem>> {
    const { skip, take, page, pageSize } = pageParams(query);
    let occurredAt: Prisma.DateTimeFilter | undefined;
    try {
      if (query.from || query.to) {
        const from = query.from ?? '2000-01-01';
        const to = query.to ?? todayLocal();
        const range = localDayRange(from, to);
        occurredAt = { gte: range.start, lte: range.end };
      }
    } catch {
      throw new AppException(400, 'INVALID_PERIOD', 'Informe datas válidas no formato AAAA-MM-DD.');
    }
    const where: Prisma.DonationWhereInput = {
      ...(occurredAt ? { occurredAt } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.bloodType ? { bloodType: query.bloodType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.donation.findMany({
        where,
        include: { attendance: { select: { campaignTitle: true } } },
        orderBy: { occurredAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.donation.count({ where }),
    ]);
    return paginated(
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        bloodType: row.bloodType,
        volumeMl: row.volumeMl,
        unitId: row.unitId,
        unitName: row.unitName,
        occurredAt: row.occurredAt.toISOString(),
        campaignTitle: row.attendance.campaignTitle,
      })),
      total,
      page,
      pageSize,
    );
  }

  private donationExists(): AppException {
    return new AppException(
      409,
      'DONATION_EXISTS',
      'A doação deste atendimento já foi registrada. Atualize a página.',
    );
  }

  private async uniqueCode(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = humanCode('DO');
      const taken = await tx.donation.findUnique({ where: { code }, select: { id: true } });
      if (!taken) return code;
    }
    throw new Error('Não foi possível gerar um código de doação único');
  }
}

export function toDonorAttendanceView(row: DonorAttendanceRow): DonorAttendanceView {
  return {
    id: row.id,
    attendedAt: row.createdAt.toISOString(),
    unitName: row.unitName,
    campaignTitle: row.campaignTitle,
    donation: row.donation
      ? {
          id: row.donation.id,
          code: row.donation.code,
          status: row.donation.status,
          volumeMl: row.donation.status === 'COMPLETED' ? row.donation.volumeMl : null,
        }
      : null,
    documents: row.documents.map((document) => ({ id: document.id, type: document.type })),
  };
}

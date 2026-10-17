import { Injectable } from '@nestjs/common';
import { AppException, AuditService, OutboxService, pageParams, paginated } from '@pulso/common';
import { EVENTS, type AdminHoursItem, type AuthUser, type Paginated } from '@pulso/contracts';
import type { Prisma } from '../../generated/prisma';
import { toHoursView } from '../hours/hours.mapper';
import { IdentityClient } from '../identity/identity.client';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminHoursQueryDto, ReviewHoursDto } from './dto/admin.dto';

const INCLUDE = { institution: { select: { id: true, name: true } } } as const;

/** Revisão das horas complementares, feita pelo administrador em nome da instituição (D9, RN15). */
@Injectable()
export class AdminHoursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityClient,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminHoursQueryDto, requestId?: string): Promise<Paginated<AdminHoursItem>> {
    const { skip, take, page, pageSize } = pageParams(query);
    const where: Prisma.ComplementaryHoursWhereInput = query.status ? { status: query.status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.complementaryHours.findMany({
        where,
        include: INCLUDE,
        // Pendentes mais antigos primeiro: a fila de revisão anda por ordem de chegada.
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip,
        take,
      }),
      this.prisma.complementaryHours.count({ where }),
    ]);
    const names = await this.identity.names(
      rows.map((row) => row.donorId),
      requestId,
    );
    return paginated(
      rows.map((row) => ({ ...toHoursView(row), donor: names.get(row.donorId)! })),
      total,
      page,
      pageSize,
    );
  }

  async review(
    actor: AuthUser,
    id: string,
    dto: ReviewHoursDto,
    requestId?: string,
  ): Promise<AdminHoursItem> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // Só pedidos pendentes: a condição no UPDATE evita duas revisões simultâneas.
      const { count } = await tx.complementaryHours.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: dto.status,
          reviewNote: dto.note || null,
          reviewedById: actor.id,
          reviewedAt: now,
        },
      });
      const row = await tx.complementaryHours.findUnique({ where: { id }, include: INCLUDE });
      if (!row) throw new AppException(404, 'HOURS_NOT_FOUND', 'Pedido de horas não encontrado.');
      if (count === 0) {
        throw new AppException(
          409,
          'HOURS_ALREADY_REVIEWED',
          'Este pedido de horas já foi revisado.',
        );
      }
      await this.outbox.enqueue(
        tx,
        EVENTS.HOURS_REVIEWED,
        {
          hoursId: row.id,
          donorId: row.donorId,
          hours: row.hours,
          status: dto.status,
          institutionName: row.institution.name,
        },
        requestId,
      );
      await this.audit.record(
        {
          actor,
          action: dto.status === 'APPROVED' ? 'hours.approved' : 'hours.rejected',
          entity: 'complementary_hours',
          entityId: row.id,
          metadata: { donorId: row.donorId, hours: row.hours, institutionId: row.institutionId },
          requestId,
        },
        tx,
      );
      return row;
    });
    const names = await this.identity.names([updated.donorId], requestId);
    return { ...toHoursView(updated), donor: names.get(updated.donorId)! };
  }
}

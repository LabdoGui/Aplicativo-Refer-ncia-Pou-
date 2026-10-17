import { Injectable } from '@nestjs/common';
import { AppException, AuditService } from '@pulso/common';
import {
  HOURS_STATUSES,
  type AuthUser,
  type HoursStatus,
  type InstitutionView,
  type MyHoursResponse,
} from '@pulso/contracts';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SetInstitutionDto } from './dto/set-institution.dto';
import { toHoursView, toInstitutionView } from './hours.mapper';

@Injectable()
export class HoursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly audit: AuditService,
  ) {}

  async activeInstitutions(): Promise<InstitutionView[]> {
    const rows = await this.prisma.partnerInstitution.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toInstitutionView);
  }

  async myHours(donorId: string): Promise<MyHoursResponse> {
    const donor = await this.gamification.ensureDonor(donorId);
    const [institution, items] = await Promise.all([
      donor.institutionId
        ? this.prisma.partnerInstitution.findUnique({ where: { id: donor.institutionId } })
        : null,
      this.prisma.complementaryHours.findMany({
        where: { donorId },
        include: { institution: { select: { id: true, name: true } } },
        orderBy: { donatedAt: 'desc' },
      }),
    ]);
    const totals = Object.fromEntries(HOURS_STATUSES.map((status) => [status, 0])) as Record<
      HoursStatus,
      number
    >;
    for (const item of items) totals[item.status as HoursStatus] += item.hours;
    return {
      institution: institution ? toInstitutionView(institution) : null,
      totals,
      items: items.map(toHoursView),
    };
  }

  async setInstitution(
    actor: AuthUser,
    dto: SetInstitutionDto,
    requestId?: string,
  ): Promise<MyHoursResponse> {
    await this.gamification.ensureDonor(actor.id);
    if (dto.institutionId) {
      const institution = await this.prisma.partnerInstitution.findUnique({
        where: { id: dto.institutionId },
      });
      if (!institution?.active) {
        throw new AppException(
          422,
          'INSTITUTION_UNAVAILABLE',
          'Esta instituição não está disponível. Escolha outra da lista.',
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.donorEngagement.update({
        where: { donorId: actor.id },
        data: { institutionId: dto.institutionId },
      });
      await this.audit.record(
        {
          actor,
          action: 'hours.institution_changed',
          entity: 'donor_engagement',
          entityId: actor.id,
          metadata: { institutionId: dto.institutionId },
          requestId,
        },
        tx,
      );
    });
    return this.myHours(actor.id);
  }
}

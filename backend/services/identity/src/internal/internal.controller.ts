import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsUUID } from 'class-validator';
import {
  ageOn,
  eachLocalDay,
  InternalOnly,
  StatsQueryDto,
  statsRange,
  toLocalDate,
} from '@pulso/common';
import { ROLES, type DonorSummary, type IdentityStats, type Role } from '@pulso/contracts';
import { PrismaService } from '../prisma/prisma.service';

class IdsQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids: string[];
}

class RoleQueryDto {
  @IsIn(ROLES)
  role: Role;
}

/** Rotas entre serviços (token interno); o gateway bloqueia /internal para fora. */
@ApiExcludeController()
@InternalOnly()
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  /** Resumo de doadores para agenda e atendimento (sem dados de contato). */
  @Get('donors/summaries')
  async donorSummaries(@Query() query: IdsQueryDto): Promise<DonorSummary[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: query.ids } },
      include: { donorProfile: true },
    });
    return users.map((user) => ({
      id: user.id,
      name: user.status === 'ANONYMIZED' ? 'Conta removida' : user.name,
      donorCode: user.donorProfile?.donorCode ?? '—',
      age: user.donorProfile ? ageOn(user.donorProfile.birthDate.toISOString().slice(0, 10)) : null,
      declaredBloodType: user.donorProfile?.declaredBloodType ?? null,
    }));
  }

  /** IDs das contas ativas de um papel (ex.: alertas de estoque para administradores). */
  @Get('users')
  async usersByRole(@Query() query: RoleQueryDto): Promise<Array<{ id: string }>> {
    return this.prisma.user.findMany({
      where: { role: query.role, status: 'ACTIVE' },
      select: { id: true },
    });
  }

  @Get('stats')
  async stats(@Query() query: StatsQueryDto): Promise<IdentityStats> {
    const { start, end } = statsRange(query);
    const [donorsTotal, staffTotal, newDonors] = await Promise.all([
      this.prisma.user.count({ where: { role: 'DONOR', status: { not: 'ANONYMIZED' } } }),
      this.prisma.user.count({ where: { role: { not: 'DONOR' }, status: 'ACTIVE' } }),
      this.prisma.user.findMany({
        where: { role: 'DONOR', createdAt: { gte: start, lte: end } },
        select: { createdAt: true },
      }),
    ]);
    const perDay = new Map<string, number>();
    for (const { createdAt } of newDonors) {
      const day = toLocalDate(createdAt);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    return {
      donorsTotal,
      donorsNewInPeriod: newDonors.length,
      newDonorsByDay: eachLocalDay(query.from, query.to).map((date) => ({
        date,
        count: perDay.get(date) ?? 0,
      })),
      staffTotal,
    };
  }
}

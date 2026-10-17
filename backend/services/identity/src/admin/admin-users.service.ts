import { Injectable } from '@nestjs/common';
import { AppException, AuditService, pageParams, paginated } from '@pulso/common';
import type { AdminUserView, AuthUser, Paginated } from '@pulso/contracts';
import { Prisma } from '../../generated/prisma';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminUsersQueryDto, CreateStaffUserDto, UpdateUserDto } from './dto/admin-users.dto';

const INCLUDE = {
  donorProfile: { select: { donorCode: true } },
  professionalProfile: { select: { unitIds: true, registryNumber: true } },
} as const;

type UserRow = Prisma.UserGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminUsersQueryDto): Promise<Paginated<AdminUserView>> {
    const { skip, take, page, pageSize } = pageParams(query);
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : { status: { not: 'ANONYMIZED' } }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search.toLowerCase() } },
              { donorProfile: { donorCode: { contains: query.search.toUpperCase() } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(
      rows.map((row) => this.toView(row)),
      total,
      page,
      pageSize,
    );
  }

  async create(
    actor: AuthUser,
    dto: CreateStaffUserDto,
    requestId?: string,
  ): Promise<AdminUserView> {
    this.assertUnits(dto.role, dto.unitIds);
    try {
      const passwordHash = await this.passwords.hash(dto.password);
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            role: dto.role,
            professionalProfile: {
              create: {
                unitIds: dto.role === 'ADMIN' ? [] : dto.unitIds,
                registryNumber: dto.registryNumber ?? null,
              },
            },
          },
          include: INCLUDE,
        });
        await this.audit.record(
          {
            actor,
            action: 'user.staff_created',
            entity: 'user',
            entityId: created.id,
            metadata: { role: dto.role, unitIds: dto.unitIds },
            requestId,
          },
          tx,
        );
        return created;
      });
      return this.toView(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          409,
          'EMAIL_TAKEN',
          'Já existe uma conta com este e-mail.',
          undefined,
          [{ field: 'email', message: 'Já existe uma conta com este e-mail.' }],
        );
      }
      throw error;
    }
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateUserDto,
    requestId?: string,
  ): Promise<AdminUserView> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: INCLUDE });
    if (!user || user.status === 'ANONYMIZED') {
      throw new AppException(404, 'USER_NOT_FOUND', 'Conta não encontrada.');
    }
    if (id === actor.id && (dto.status === 'DISABLED' || (dto.role && dto.role !== 'ADMIN'))) {
      throw new AppException(
        422,
        'SELF_LOCKOUT',
        'Você não pode desativar nem rebaixar a própria conta.',
      );
    }
    if (user.role === 'DONOR' && (dto.role || dto.unitIds || dto.registryNumber !== undefined)) {
      throw new AppException(
        422,
        'DONOR_ROLE_FIXED',
        'Contas de doador só podem ser ativadas ou desativadas.',
      );
    }
    const role = dto.role ?? user.role;
    const unitIds = dto.unitIds ?? user.professionalProfile?.unitIds ?? [];
    if (role !== 'DONOR') this.assertUnits(role, unitIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(role !== 'DONOR'
            ? {
                professionalProfile: {
                  upsert: {
                    create: {
                      unitIds: role === 'ADMIN' ? [] : unitIds,
                      registryNumber: dto.registryNumber ?? null,
                    },
                    update: {
                      unitIds: role === 'ADMIN' ? [] : unitIds,
                      ...(dto.registryNumber !== undefined
                        ? { registryNumber: dto.registryNumber }
                        : {}),
                    },
                  },
                },
              }
            : {}),
        },
        include: INCLUDE,
      });
      await this.audit.record(
        {
          actor,
          action: 'user.updated_by_admin',
          entity: 'user',
          entityId: id,
          metadata: { fields: Object.keys(dto), status: dto.status, role: dto.role },
          requestId,
        },
        tx,
      );
      return row;
    });
    // Papel, unidades ou status mudaram: sessões antigas não podem continuar valendo.
    if (dto.status === 'DISABLED' || dto.role !== undefined || dto.unitIds !== undefined) {
      await this.auth.revokeAllSessions(id);
    }
    return this.toView(updated);
  }

  private assertUnits(role: string, unitIds: string[]): void {
    if ((role === 'NURSE' || role === 'COLLABORATOR') && unitIds.length === 0) {
      throw new AppException(
        422,
        'UNITS_REQUIRED',
        'Vincule a pessoa a pelo menos uma unidade.',
        undefined,
        [{ field: 'unitIds', message: 'Selecione pelo menos uma unidade.' }],
      );
    }
  }

  private toView(row: UserRow): AdminUserView {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      unitIds: row.professionalProfile?.unitIds ?? [],
      registryNumber: row.professionalProfile?.registryNumber ?? null,
      donorCode: row.donorProfile?.donorCode ?? null,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    };
  }
}

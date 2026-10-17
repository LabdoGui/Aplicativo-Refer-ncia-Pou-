import { Controller, DynamicModule, Get, Inject, Injectable, Module, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { randomUUID } from 'node:crypto';
import type { AuditLogEntry, AuthUser } from '@pulso/contracts';
import { InternalOnly } from '../auth/decorators';
import type { RawSqlExecutor } from '../prisma/raw-client';
import { PRISMA_CLIENT, SERVICE_NAME } from '../tokens';

export interface AuditRecord {
  actor?: Pick<AuthUser, 'id' | 'role'> | null;
  /** Verbo no formato `<entidade>.<ação>` (ex.: donor.viewed, stock.movement_created). */
  action: string;
  entity: string;
  entityId?: string | null;
  /** Só identificadores e fatos mínimos: nunca respostas de saúde nem senhas. */
  metadata?: Record<string, unknown>;
  requestId?: string;
}

interface AuditRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: Date;
}

/** Trilha de auditoria do serviço (tabela `audit_logs`), append-only. */
@Injectable()
export class AuditService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: RawSqlExecutor,
    @Inject(SERVICE_NAME) private readonly serviceName: string,
  ) {}

  /** Registra uma ação. Passe `tx` para gravar junto com a operação auditada. */
  async record(entry: AuditRecord, tx: RawSqlExecutor = this.prisma): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO "audit_logs" ("id", "actorId", "actorRole", "action", "entity", "entityId", "metadata", "requestId", "createdAt")
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, now())`,
      randomUUID(),
      entry.actor?.id ?? null,
      entry.actor?.role ?? null,
      entry.action,
      entry.entity,
      entry.entityId ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.requestId ?? null,
    );
  }

  async list(query: AuditQueryDto): Promise<AuditLogEntry[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (query.from) {
      values.push(query.from);
      conditions.push(`"createdAt" >= $${values.length}::timestamptz`);
    }
    if (query.to) {
      values.push(query.to);
      conditions.push(`"createdAt" <= $${values.length}::timestamptz`);
    }
    if (query.action) {
      values.push(`${query.action}%`);
      conditions.push(`"action" LIKE $${values.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit ?? 100;
    const rows = await this.prisma.$queryRawUnsafe<AuditRow[]>(
      `SELECT "id", "actorId", "actorRole", "action", "entity", "entityId", "metadata", "requestId", "createdAt"
         FROM "audit_logs" ${where} ORDER BY "createdAt" DESC LIMIT ${limit}`,
      ...values,
    );
    return rows.map((row) => ({
      ...row,
      service: this.serviceName,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

export class AuditQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

/** Leitura da trilha pelo gateway (GET /internal/audit-logs), composta em /audit-logs. */
@ApiExcludeController()
@Controller('internal/audit-logs')
export class AuditInternalController {
  constructor(private readonly audit: AuditService) {}

  @InternalOnly()
  @Get()
  list(@Query() query: AuditQueryDto): Promise<AuditLogEntry[]> {
    return this.audit.list(query);
  }
}

@Module({})
export class AuditModule {
  static forRoot(): DynamicModule {
    return {
      module: AuditModule,
      global: true,
      controllers: [AuditInternalController],
      providers: [AuditService],
      exports: [AuditService],
    };
  }
}

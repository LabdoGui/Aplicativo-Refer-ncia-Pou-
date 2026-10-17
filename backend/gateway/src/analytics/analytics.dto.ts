import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StatsQueryDto } from '@pulso/common';
import type { ServiceName } from '@pulso/contracts';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_MESSAGE = 'Informe a data no formato AAAA-MM-DD.';

/** Serviços com trilha de auditoria (o notification não guarda ações de pessoas). */
export const AUDITED_SERVICES = [
  'identity',
  'scheduling',
  'clinical',
  'inventory',
  'engagement',
] as const satisfies readonly ServiceName[];
export type AuditedService = (typeof AUDITED_SERVICES)[number];

export const AUDIT_LOGS_DEFAULT_LIMIT = 100;
export const AUDIT_LOGS_MAX_LIMIT = 500;

/** Filtros do dashboard: período em datas locais (America/Sao_Paulo), unidade e tipo sanguíneo. */
export class DashboardQueryDto extends StatsQueryDto {
  @ApiProperty({ example: '2026-09-17', description: 'Data inicial (AAAA-MM-DD), inclusiva' })
  @Matches(LOCAL_DATE, { message: LOCAL_DATE_MESSAGE })
  declare from: string;

  @ApiProperty({ example: '2026-10-17', description: 'Data final (AAAA-MM-DD), inclusiva' })
  @Matches(LOCAL_DATE, { message: LOCAL_DATE_MESSAGE })
  declare to: string;
}

export class AuditLogsQueryDto {
  @ApiPropertyOptional({ enum: AUDITED_SERVICES, description: 'Só a trilha de um serviço' })
  @IsOptional()
  @IsIn(AUDITED_SERVICES)
  service?: AuditedService;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00-03:00',
    description: 'A partir de (ISO 8601)',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-17T23:59:59-03:00', description: 'Até (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 'stock.', description: 'Começo do nome da ação (ex.: "auth.")' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @ApiPropertyOptional({
    default: AUDIT_LOGS_DEFAULT_LIMIT,
    minimum: 1,
    maximum: AUDIT_LOGS_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_LOGS_MAX_LIMIT)
  limit?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type {
  CancelAppointmentRequest,
  CreateAppointmentRequest,
  RescheduleAppointmentRequest,
} from '@pulso/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class AvailabilityQueryDto {
  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: '2026-10-20', description: 'AAAA-MM-DD (fuso da unidade)' })
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'Informe a data no formato AAAA-MM-DD.' })
  from: string;

  @ApiProperty({ example: '2026-10-31', description: 'AAAA-MM-DD (fuso da unidade)' })
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'Informe a data no formato AAAA-MM-DD.' })
  to: string;
}

export class CreateAppointmentDto implements CreateAppointmentRequest {
  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: '2026-10-20T11:00:00.000Z', description: 'Início da vaga (ISO 8601)' })
  @IsISO8601({ strict: true })
  startsAt: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  campaignId?: string | null;
}

export class RescheduleAppointmentDto implements RescheduleAppointmentRequest {
  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: '2026-10-22T13:30:00.000Z' })
  @IsISO8601({ strict: true })
  startsAt: string;
}

export class CancelAppointmentDto implements CancelAppointmentRequest {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  reason?: string;
}

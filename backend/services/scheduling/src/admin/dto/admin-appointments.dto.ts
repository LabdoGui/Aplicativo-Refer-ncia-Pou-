import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '@pulso/common';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '@pulso/contracts';
import { DATE_ONLY } from '../../appointments/dto/appointments.dto';

export class AdminAppointmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: APPOINTMENT_STATUSES })
  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'AAAA-MM-DD' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'Informe a data no formato AAAA-MM-DD.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'AAAA-MM-DD' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'Informe a data no formato AAAA-MM-DD.' })
  to?: string;
}

export class AdminCancelAppointmentDto {
  @ApiProperty({ minLength: 3, maxLength: 200, example: 'Unidade fechada por manutenção' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}

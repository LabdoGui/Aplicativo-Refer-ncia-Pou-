import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '@pulso/common';
import {
  BLOOD_TYPES,
  DONATION_STATUSES,
  type BloodType,
  type DonationStatus,
  type RecordDonationRequest,
} from '@pulso/contracts';

export class RecordDonationDto implements RecordDonationRequest {
  @ApiProperty()
  @IsUUID('4')
  attendanceId: string;

  @ApiProperty({ enum: BLOOD_TYPES })
  @IsIn(BLOOD_TYPES)
  bloodType: BloodType;

  @ApiProperty({ minimum: 0, maximum: 1000, description: 'Volume coletado (mL)' })
  @IsInt()
  @Min(0)
  @Max(1000)
  volumeMl: number;

  @ApiProperty({ enum: DONATION_STATUSES, description: 'NOT_COMPLETED = coleta interrompida' })
  @IsIn(DONATION_STATUSES)
  status: DonationStatus;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AdminDonationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: BLOOD_TYPES })
  @IsOptional()
  @IsIn(BLOOD_TYPES)
  bloodType?: BloodType;

  @ApiPropertyOptional({ enum: DONATION_STATUSES })
  @IsOptional()
  @IsIn(DONATION_STATUSES)
  status?: DonationStatus;
}

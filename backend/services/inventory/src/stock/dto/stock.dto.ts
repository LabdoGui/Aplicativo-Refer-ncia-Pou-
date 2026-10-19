import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '@pulso/common';
import {
  BLOOD_TYPES,
  MOVEMENT_REASON_CODES,
  MOVEMENT_TYPES,
  type BloodType,
  type CreateMovementRequest,
  type MovementReason,
  type MovementsQuery,
  type MovementType,
  type UpdateThresholdsRequest,
} from '@pulso/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const MAX_MOVEMENT_QUANTITY = 10_000;
export const MAX_THRESHOLD = 100_000;

export class CreateMovementDto implements CreateMovementRequest {
  @ApiProperty({ enum: BLOOD_TYPES })
  @IsIn(BLOOD_TYPES)
  bloodType: BloodType;

  @ApiProperty({ enum: MOVEMENT_TYPES, description: 'IN = entrada, OUT = saída' })
  @IsIn(MOVEMENT_TYPES)
  type: MovementType;

  @ApiProperty({ minimum: 1, maximum: MAX_MOVEMENT_QUANTITY, description: 'Quantidade de bolsas' })
  @IsInt()
  @Min(1)
  @Max(MAX_MOVEMENT_QUANTITY)
  quantity: number;

  @ApiProperty({ enum: MOVEMENT_REASON_CODES, description: 'Precisa corresponder ao tipo' })
  @IsIn(MOVEMENT_REASON_CODES)
  reason: MovementReason;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Data e hora da movimentação (ISO 8601). Padrão: agora. Até 30 dias atrás.',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

export class MovementsQueryDto extends PaginationQueryDto implements MovementsQuery {
  @ApiPropertyOptional({ enum: BLOOD_TYPES })
  @IsOptional()
  @IsIn(BLOOD_TYPES)
  bloodType?: BloodType;

  @ApiPropertyOptional({ enum: MOVEMENT_TYPES })
  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  type?: MovementType;

  @ApiPropertyOptional({ description: 'Data local inicial (AAAA-MM-DD)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ description: 'Data local final (AAAA-MM-DD)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ minimum: 7, maximum: 90, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  days?: number;
}

export class BloodTypeParamDto {
  @ApiProperty({ enum: BLOOD_TYPES })
  @IsIn(BLOOD_TYPES)
  bloodType: BloodType;
}

export class UpdateThresholdsDto implements UpdateThresholdsRequest {
  @ApiProperty({ minimum: 0, maximum: MAX_THRESHOLD, description: 'Abaixo disto: crítico' })
  @IsInt()
  @Min(0)
  @Max(MAX_THRESHOLD)
  minimum: number;

  @ApiProperty({ minimum: 0, maximum: MAX_THRESHOLD, description: 'A partir disto: adequado' })
  @IsInt()
  @Min(0)
  @Max(MAX_THRESHOLD)
  ideal: number;
}

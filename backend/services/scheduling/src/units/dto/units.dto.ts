import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  UNIT_STATUSES,
  type CreateScheduleBlockRequest,
  type ReplaceScheduleRulesRequest,
  type ScheduleRuleInput,
  type UnitInput,
  type UnitStatus,
} from '@pulso/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class IncludeInactiveQueryDto {
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Inclui inativos (só administração)',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: 'true' | 'false';
}

export class UnitInputDto implements UnitInput {
  @ApiProperty({ example: 'SangueConecta Unidade Centro' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Rua da Solidariedade, 120' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address: string;

  @ApiProperty({ example: 'Centro' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  district: string;

  @ApiProperty({ example: 'São Paulo' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;

  @ApiProperty({ example: 'SP' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'Informe a sigla do estado com 2 letras (ex.: SP).' })
  state: string;

  @ApiPropertyOptional({ example: '01000-000', nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/^(\d{5})(\d{3})$/, '$1-$2') : value,
  )
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{5}-\d{3}$/, { message: 'Informe o CEP no formato 00000-000.' })
  zipCode?: string | null;

  @ApiPropertyOptional({ example: '0800 000 0101', nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\+?[\d\s().-]{8,20}$/, { message: 'Informe um telefone válido.' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Seg. a sex., 8h às 17h', nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  openingHours?: string | null;

  @ApiPropertyOptional({ enum: UNIT_STATUSES })
  @IsOptional()
  @IsIn(UNIT_STATUSES)
  status?: UnitStatus;
}

export class UpdateUnitDto extends PartialType(UnitInputDto) {}

export class ScheduleRuleInputDto implements ScheduleRuleInput {
  @ApiProperty({ minimum: 1, maximum: 7, description: '1 = segunda … 7 = domingo' })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number;

  @ApiProperty({ example: '08:00' })
  @Matches(HH_MM, { message: 'Use o formato HH:mm (ex.: 08:00).' })
  startTime: string;

  @ApiProperty({ example: '12:00' })
  @Matches(HH_MM, { message: 'Use o formato HH:mm (ex.: 12:00).' })
  endTime: string;

  @ApiProperty({ minimum: 10, maximum: 120, example: 30 })
  @IsInt()
  @Min(10)
  @Max(120)
  slotMinutes: number;

  @ApiProperty({ minimum: 1, maximum: 50, example: 3 })
  @IsInt()
  @Min(1)
  @Max(50)
  capacity: number;

  @ApiProperty()
  @IsBoolean()
  active: boolean;
}

export class ReplaceScheduleRulesDto implements ReplaceScheduleRulesRequest {
  @ApiProperty({ type: [ScheduleRuleInputDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ScheduleRuleInputDto)
  rules: ScheduleRuleInputDto[];
}

export class CreateScheduleBlockDto implements CreateScheduleBlockRequest {
  @ApiProperty({ example: '2026-11-02T11:00:00.000Z' })
  @IsISO8601({ strict: true })
  startsAt: string;

  @ApiProperty({ example: '2026-11-02T15:00:00.000Z' })
  @IsISO8601({ strict: true })
  endsAt: string;

  @ApiProperty({ example: 'Manutenção dos equipamentos' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}

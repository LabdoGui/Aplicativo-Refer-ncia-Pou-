import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '@pulso/common';
import {
  HOURS_STATUSES,
  POINTS_BASES,
  type HoursStatus,
  type InstitutionInput,
  type PointsBasis,
  type ReviewHoursRequest,
  type UpdateAchievementRequest,
  type UpdateGamificationSettingsRequest,
} from '@pulso/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AdminHoursQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: HOURS_STATUSES })
  @IsOptional()
  @IsIn(HOURS_STATUSES)
  status?: HoursStatus;
}

export class ReviewHoursDto implements ReviewHoursRequest {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ maxLength: 300, description: 'Observação mostrada ao doador' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpdateAchievementDto implements UpdateAchievementRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateGamificationSettingsDto implements UpdateGamificationSettingsRequest {
  @ApiPropertyOptional({
    enum: POINTS_BASES,
    description: 'ATTENDANCE: pontos por comparecimento (D4); DONATION: só por doação concluída',
  })
  @IsOptional()
  @IsIn(POINTS_BASES)
  pointsBasis?: PointsBasis;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  firstPoints?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  recurringPoints?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  campaignPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rankingEnabled?: boolean;
}

export class CreateInstitutionDto implements InstitutionInput {
  @ApiProperty({ example: 'Faculdade Exemplo de Ciências da Saúde' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @ApiProperty({ minimum: 1, maximum: 40, description: 'Regra da própria instituição (fictícia)' })
  @IsInt()
  @Min(1)
  @Max(40)
  hoursPerDonation: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateInstitutionDto implements Partial<InstitutionInput> {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40)
  hoursPerDonation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

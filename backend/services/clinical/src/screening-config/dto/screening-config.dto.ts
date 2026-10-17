import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
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
  SCREENING_FIELD_TYPES,
  type ScreeningFieldType,
  type UpdateQuestionRequest,
  type UpdateScreeningRuleRequest,
} from '@pulso/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateQuestionDto implements UpdateQuestionRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  text?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  helpText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRuleDto implements UpdateScreeningRuleRequest {
  @ApiPropertyOptional({
    description: 'Orientação exibida ao doador (use {date} para a data informativa)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class FieldOptionDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  value: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label: string;
}

/** Campos editáveis de um campo da triagem (código e tipo são fixos após a criação). */
export class UpdateFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(20)
  unit?: string | null;

  @ApiPropertyOptional({ type: [FieldOptionDto], nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FieldOptionDto)
  options?: FieldOptionDto[] | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  helpText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Só contra erro de digitação' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  min?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Só contra erro de digitação' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  max?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateFieldDto extends UpdateFieldDto {
  @ApiProperty({ example: 'OXYGEN_SATURATION', description: 'Maiúsculas, números e _' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,39}$/, {
    message: 'Use de 2 a 40 caracteres: letras maiúsculas, números e _ (começando por letra).',
  })
  code: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  declare label: string;

  @ApiProperty({ enum: SCREENING_FIELD_TYPES })
  @IsIn(SCREENING_FIELD_TYPES)
  type: ScreeningFieldType;
}

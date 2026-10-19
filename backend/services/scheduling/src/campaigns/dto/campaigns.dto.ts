import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BLOOD_TYPES, type BloodType, type CampaignInput } from '@pulso/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CampaignInputDto implements CampaignInput {
  @ApiProperty({ example: 'Reforço para O− e A−' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  description: string;

  @ApiProperty({ enum: BLOOD_TYPES, isArray: true, description: 'Vazio = todos os tipos' })
  @IsArray()
  @ArrayMaxSize(BLOOD_TYPES.length)
  @ArrayUnique({ message: 'Não repita tipos sanguíneos.' })
  @IsIn(BLOOD_TYPES, { each: true })
  bloodTypes: BloodType[];

  @ApiPropertyOptional({ nullable: true, description: 'Vazio = todas as unidades' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  unitId?: string | null;

  @ApiProperty({ example: '2026-11-01' })
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'Informe a data no formato AAAA-MM-DD.' })
  startsAt: string;

  @ApiProperty({ example: '2026-11-30' })
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'Informe a data no formato AAAA-MM-DD.' })
  endsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCampaignDto extends PartialType(CampaignInputDto) {}

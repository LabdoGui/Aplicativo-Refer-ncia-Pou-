import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  SCREENING_RESULTS,
  type AnswerValue,
  type ProfessionalScreeningRequest,
  type ScreeningResult,
} from '@pulso/contracts';

export class ProfessionalScreeningDto implements ProfessionalScreeningRequest {
  @ApiProperty()
  @IsUUID('4')
  appointmentId: string;

  @ApiProperty({
    description: 'Valores por código do campo configurado',
    example: { WEIGHT: 68.5, BLOOD_PRESSURE: '120/80', HEART_RATE: 72 },
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  values: Record<string, AnswerValue>;

  @ApiProperty({ enum: SCREENING_RESULTS, description: 'Definido pelo profissional de saúde' })
  @IsIn(SCREENING_RESULTS)
  result: ScreeningResult;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

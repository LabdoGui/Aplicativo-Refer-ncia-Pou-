import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { UpdateClinicalSettingsRequest } from '@pulso/contracts';

export class UpdateClinicalSettingsDto implements UpdateClinicalSettingsRequest {
  @ApiPropertyOptional({
    minimum: 30,
    maximum: 365,
    description: 'Intervalo informativo entre doações (dias). Parâmetro da instituição, a validar.',
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(365)
  donationIntervalDays?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 90, description: 'Validade da pré-triagem (dias)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  preScreeningValidityDays?: number;
}

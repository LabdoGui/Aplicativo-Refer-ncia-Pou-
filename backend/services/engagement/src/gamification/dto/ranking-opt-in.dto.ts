import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import type { RankingOptInRequest } from '@pulso/contracts';

/** Letras (inclusive acentuadas), números, espaço, ponto, sublinhado e hífen. */
export const NICKNAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 ._-]+$/;

export class RankingOptInDto implements RankingOptInRequest {
  @ApiProperty({ description: 'Participar do ranking público (opcional, RN20)' })
  @IsBoolean()
  optIn: boolean;

  @ApiPropertyOptional({
    description:
      'Apelido exibido no ranking (obrigatório ao participar). Nunca use seu nome completo.',
    minLength: 3,
    maxLength: 24,
  })
  @ValidateIf((dto: RankingOptInDto) => dto.optIn === true)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString({ message: 'Informe um apelido para aparecer no ranking.' })
  @MinLength(3)
  @MaxLength(24)
  @Matches(NICKNAME_PATTERN, {
    message: 'Use letras, números, espaços, ponto, hífen ou sublinhado.',
  })
  nickname?: string;
}

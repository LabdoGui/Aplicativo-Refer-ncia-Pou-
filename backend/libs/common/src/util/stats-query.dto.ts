import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { BLOOD_TYPES, type BloodType, type StatsFilters } from '@pulso/contracts';
import { AppException } from '../errors/app.exception';
import { localDayRange } from './dates';

/** Maior intervalo aceito nos filtros de estatística. */
export const MAX_STATS_RANGE_DAYS = 400;

/** Filtros comuns de /internal/stats e do dashboard (datas AAAA-MM-DD). */
export class StatsQueryDto implements StatsFilters {
  @IsISO8601({ strict: true })
  from: string;

  @IsISO8601({ strict: true })
  to: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: BLOOD_TYPES })
  @IsOptional()
  @IsIn(BLOOD_TYPES)
  bloodType?: BloodType;
}

/** Converte os filtros em intervalo UTC, validando a ordem e o tamanho. */
export function statsRange(query: StatsFilters): { start: Date; end: Date } {
  let range: { start: Date; end: Date };
  try {
    range = localDayRange(query.from, query.to);
  } catch {
    throw new AppException(400, 'INVALID_PERIOD', 'Informe datas válidas no formato AAAA-MM-DD.');
  }
  if (range.start > range.end) {
    throw new AppException(400, 'INVALID_PERIOD', 'A data inicial deve ser anterior à final.');
  }
  const days = (range.end.getTime() - range.start.getTime()) / 86_400_000;
  if (days > MAX_STATS_RANGE_DAYS) {
    throw new AppException(
      400,
      'INVALID_PERIOD',
      `O período pode ter no máximo ${MAX_STATS_RANGE_DAYS} dias.`,
    );
  }
  return range;
}

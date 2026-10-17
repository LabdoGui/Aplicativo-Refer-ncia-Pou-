import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';
import { DATE_ONLY } from '../../appointments/dto/appointments.dto';

export class AgendaQueryDto {
  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiPropertyOptional({
    example: '2026-10-17',
    description: 'AAAA-MM-DD (padrão: hoje no fuso da unidade)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'Informe a data no formato AAAA-MM-DD.' })
  date?: string;
}

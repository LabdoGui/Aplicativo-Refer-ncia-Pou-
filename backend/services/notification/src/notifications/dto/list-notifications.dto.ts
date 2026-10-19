import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@pulso/common';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  /** Texto, não booleano: a conversão implícita transformaria "false" em verdadeiro. */
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    default: 'false',
    description: 'Só as não lidas',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  onlyUnread?: 'true' | 'false';
}

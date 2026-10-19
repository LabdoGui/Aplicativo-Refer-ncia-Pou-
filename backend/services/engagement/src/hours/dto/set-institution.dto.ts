import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';
import type { SetInstitutionRequest } from '@pulso/contracts';

export class SetInstitutionDto implements SetInstitutionRequest {
  @ApiProperty({
    nullable: true,
    description: 'Instituição de ensino parceira; null desfaz o vínculo',
  })
  @ValidateIf((dto: SetInstitutionDto) => dto.institutionId !== null)
  @IsUUID('4', { message: 'Selecione uma instituição da lista.' })
  institutionId: string | null;
}

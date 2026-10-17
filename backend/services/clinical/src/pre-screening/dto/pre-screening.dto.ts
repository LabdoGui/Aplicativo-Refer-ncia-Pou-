import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsObject } from 'class-validator';
import type { AnswerValue, PreScreeningSubmitRequest } from '@pulso/contracts';

export class PreScreeningSubmitDto implements PreScreeningSubmitRequest {
  @ApiProperty({
    description: 'Respostas por código da pergunta (sim/não, opção, número ou data AAAA-MM-DD)',
    example: { WEIGHT_50: true, FEELING_WELL: true, DONATED_BEFORE: false },
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  answers: Record<string, AnswerValue>;

  @ApiProperty({
    description:
      'Consentimento específico: a equipe da unidade pode ver as respostas. Sem ele, só o resultado é guardado.',
  })
  @IsBoolean()
  shareWithStaff: boolean;
}

export class RevokeSharingDto {
  @ApiProperty({ enum: [false], description: 'Só é possível revogar (false)' })
  @IsBoolean()
  @Equals(false, { message: 'Só é possível revogar o compartilhamento.' })
  shared: boolean;
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AuthUser, PreScreeningQuestionnaire, PreScreeningResultView } from '@pulso/contracts';
import { PreScreeningSubmitDto, RevokeSharingDto } from './dto/pre-screening.dto';
import { PreScreeningService } from './pre-screening.service';

@ApiTags('Pré-triagem (informativa)')
@ApiBearerAuth()
@RequirePermissions('self:prescreening')
@Controller('screenings')
export class PreScreeningController {
  constructor(private readonly preScreenings: PreScreeningService) {}

  @Get('questionnaire')
  @ApiOperation({ summary: 'Questionário vigente (6 etapas), com o aviso de caráter informativo' })
  @ApiConflictResponse({ description: 'Nenhum questionário publicado (PRESCREENING_UNAVAILABLE)' })
  questionnaire(): Promise<PreScreeningQuestionnaire> {
    return this.preScreenings.questionnaire();
  }

  @Post('pre-check')
  @ApiOperation({
    summary:
      'Enviar respostas e receber orientação informativa (nunca autoriza nem impede a doação)',
  })
  submit(
    @Body() dto: PreScreeningSubmitDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<PreScreeningResultView> {
    return this.preScreenings.submit(requireUser(user), dto, requestId);
  }

  @Get('pre-check/me/latest')
  @ApiOperation({ summary: 'Último resultado do doador' })
  @ApiOkResponse({ description: 'Último resultado' })
  @ApiNoContentResponse({ description: 'O doador ainda não respondeu a pré-triagem' })
  async latest(
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthUser,
  ): Promise<PreScreeningResultView | undefined> {
    const latest = await this.preScreenings.latest(requireUser(user));
    if (!latest) {
      response.status(204);
      return undefined;
    }
    return latest;
  }

  @Patch('pre-check/:id/sharing')
  @ApiOperation({
    summary:
      'Revogar o compartilhamento com a equipe. As respostas guardadas são apagadas e o compartilhamento não pode ser reativado (responda de novo, se quiser).',
  })
  revokeSharing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() _dto: RevokeSharingDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<PreScreeningResultView> {
    return this.preScreenings.revokeSharing(requireUser(user), id, requestId);
  }
}

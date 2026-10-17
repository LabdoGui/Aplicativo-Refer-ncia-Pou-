import { Controller, Get, Logger, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions } from '@pulso/common';
import { API_PREFIX, type AuditLogsResponse, type AuthUser } from '@pulso/contracts';
import { AuditLogsQueryDto } from './analytics.dto';
import { AuditLogsService } from './audit-logs.service';

@ApiTags('Auditoria')
@ApiBearerAuth()
@RequirePermissions('audit:read')
@Controller(`${API_PREFIX}/audit-logs`)
export class AuditLogsController {
  private readonly logger = new Logger(AuditLogsController.name);

  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Trilha de auditoria unificada',
    description:
      'Ações registradas pelos serviços (identidade, agendamento, clínico, estoque e engajamento), ' +
      'das mais recentes para as mais antigas. Serviços que não responderam aparecem em `unavailable`.',
  })
  @ApiOkResponse({
    description: 'Registros de auditoria',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        unavailable: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Perfil sem acesso à auditoria' })
  list(
    @Query() query: AuditLogsQueryDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AuditLogsResponse> {
    // Quem consultou a trilha também fica registrado (no log estruturado do gateway).
    this.logger.log(
      { requestId, actorId: user?.id, service: query.service ?? 'todos' },
      'Trilha de auditoria consultada',
    );
    return this.auditLogs.list(query, requestId);
  }
}

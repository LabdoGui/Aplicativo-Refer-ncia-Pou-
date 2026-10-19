import { Controller, Get, Header, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public, RequestId, RequirePermissions } from '@pulso/common';
import { API_PREFIX, type DashboardStatistics, type PublicStats } from '@pulso/contracts';
import { DashboardQueryDto } from './analytics.dto';
import { DashboardService } from './dashboard.service';

const SECTION = {
  type: 'object',
  nullable: true,
  description: 'null quando o serviço não respondeu',
};

@ApiTags('Dashboard')
@Controller(`${API_PREFIX}/dashboard`)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('statistics')
  @ApiBearerAuth()
  @RequirePermissions('analytics:read')
  @ApiOperation({
    summary: 'Indicadores do painel administrativo',
    description:
      'Reúne as estatísticas de cada serviço para o período e os filtros informados. Se um serviço ' +
      'não responder, a parte dele vem como null e o nome dele aparece em `unavailable`.',
  })
  @ApiOkResponse({
    description: 'Indicadores por serviço',
    schema: {
      type: 'object',
      properties: {
        filters: { type: 'object' },
        generatedAt: { type: 'string', format: 'date-time' },
        identity: SECTION,
        scheduling: SECTION,
        clinical: SECTION,
        inventory: SECTION,
        engagement: SECTION,
        unavailable: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Período inválido' })
  @ApiForbiddenResponse({ description: 'Perfil sem acesso aos indicadores' })
  statistics(
    @Query() query: DashboardQueryDto,
    @RequestId() requestId?: string,
  ): Promise<DashboardStatistics> {
    return this.dashboard.statistics(query, requestId);
  }

  @Public()
  @Get('public-stats')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary: 'Números públicos para a página inicial',
    description:
      'Doações dos últimos 30 dias, unidades ativas, doadores cadastrados e o status (não a ' +
      'quantidade) do estoque de cada tipo sanguíneo. Dados fictícios no ambiente acadêmico.',
  })
  @ApiOkResponse({
    description: 'Números agregados, sem dados pessoais',
    schema: {
      type: 'object',
      properties: {
        donationsLast30Days: { type: 'integer', nullable: true },
        activeUnits: { type: 'integer', nullable: true },
        donorsRegistered: { type: 'integer', nullable: true },
        stock: {
          type: 'array',
          items: {
            type: 'object',
            properties: { bloodType: { type: 'string' }, status: { type: 'string' } },
          },
        },
        generatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  publicStats(@RequestId() requestId?: string): Promise<PublicStats> {
    return this.dashboard.publicStats(requestId);
  }
}

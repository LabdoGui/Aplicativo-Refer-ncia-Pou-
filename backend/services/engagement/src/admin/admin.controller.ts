import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type {
  AdminAchievementView,
  AdminHoursItem,
  AuthUser,
  GamificationSettingsView,
  InstitutionView,
  Paginated,
} from '@pulso/contracts';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminHoursService } from './admin-hours.service';
import {
  AdminHoursQueryDto,
  CreateInstitutionDto,
  ReviewHoursDto,
  UpdateAchievementDto,
  UpdateGamificationSettingsDto,
  UpdateInstitutionDto,
} from './dto/admin.dto';

@ApiTags('Administração — horas complementares')
@ApiBearerAuth()
@RequirePermissions('hours:review')
@Controller('admin/complementary-hours')
export class AdminHoursController {
  constructor(private readonly hours: AdminHoursService) {}

  @Get()
  @ApiOperation({ summary: 'Fila de pedidos de horas (pendentes mais antigos primeiro)' })
  list(
    @Query() query: AdminHoursQueryDto,
    @RequestId() requestId?: string,
  ): Promise<Paginated<AdminHoursItem>> {
    return this.hours.list(query, requestId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Aprovar ou recusar um pedido de horas em nome da instituição parceira',
    description: 'Só pedidos pendentes; o doador é notificado.',
  })
  @ApiConflictResponse({ description: 'Pedido já revisado' })
  review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewHoursDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AdminHoursItem> {
    return this.hours.review(requireUser(user), id, dto, requestId);
  }
}

@ApiTags('Administração — instituições parceiras')
@ApiBearerAuth()
@RequirePermissions('hours:review')
@Controller('admin/institutions')
export class AdminInstitutionsController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Todas as instituições (ativas e inativas)' })
  list(): Promise<InstitutionView[]> {
    return this.catalog.institutions();
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar instituição parceira (fictícia)' })
  @ApiConflictResponse({ description: 'Nome já cadastrado' })
  create(
    @Body() dto: CreateInstitutionDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<InstitutionView> {
    return this.catalog.createInstitution(requireUser(user), dto, requestId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar instituição',
    description: 'Mudar as horas por doação vale só para os próximos pedidos.',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInstitutionDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<InstitutionView> {
    return this.catalog.updateInstitution(requireUser(user), id, dto, requestId);
  }
}

@ApiTags('Administração — gamificação')
@ApiBearerAuth()
@RequirePermissions('gamification:manage')
@Controller('admin')
export class AdminGamificationController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get('achievements')
  @ApiOperation({ summary: 'Conquistas e quantos doadores já as obtiveram' })
  achievements(): Promise<AdminAchievementView[]> {
    return this.catalog.achievements();
  }

  @Patch('achievements/:code')
  @ApiOperation({ summary: 'Editar nome, descrição ou ativar/desativar uma conquista' })
  updateAchievement(
    @Param('code') code: string,
    @Body() dto: UpdateAchievementDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AdminAchievementView> {
    return this.catalog.updateAchievement(requireUser(user), code, dto, requestId);
  }

  @Get('gamification/settings')
  @ApiOperation({ summary: 'Parâmetros de pontuação e do ranking' })
  settings(): Promise<GamificationSettingsView> {
    return this.catalog.getSettings();
  }

  @Patch('gamification/settings')
  @ApiOperation({
    summary: 'Alterar pontuação, base dos pontos ou ativar/desativar o ranking',
    description:
      'Mudanças valem só para os próximos eventos; pontos já lançados não são recalculados.',
  })
  updateSettings(
    @Body() dto: UpdateGamificationSettingsDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<GamificationSettingsView> {
    return this.catalog.updateSettings(requireUser(user), dto, requestId);
  }
}

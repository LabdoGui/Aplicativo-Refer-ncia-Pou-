import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppException,
  CurrentUser,
  Public,
  RequestId,
  RequirePermissions,
  requireUser,
} from '@pulso/common';
import type { AuthUser, ScheduleBlockView, ScheduleRuleView, UnitView } from '@pulso/contracts';
import {
  CreateScheduleBlockDto,
  IncludeInactiveQueryDto,
  ReplaceScheduleRulesDto,
  UnitInputDto,
  UpdateUnitDto,
} from './dto/units.dto';
import { canManageUnits, UnitsService } from './units.service';

/** `includeInactive=true` só para quem administra unidades. */
function wantsInactive(query: IncludeInactiveQueryDto, user: AuthUser | undefined): boolean {
  if (query.includeInactive !== 'true') return false;
  if (!canManageUnits(user)) {
    throw new AppException(403, 'FORBIDDEN', 'Só a administração vê unidades inativas.');
  }
  return true;
}

@ApiTags('Unidades')
@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Unidades de coleta ativas (inativas só para a administração)' })
  list(
    @Query() query: IncludeInactiveQueryDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<UnitView[]> {
    return this.units.list(wantsInactive(query, user));
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma unidade' })
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<UnitView> {
    return this.units.get(id, canManageUnits(user));
  }

  @ApiBearerAuth()
  @RequirePermissions('unit:manage')
  @Post()
  @ApiOperation({ summary: 'Cadastrar unidade' })
  create(
    @Body() dto: UnitInputDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<UnitView> {
    return this.units.create(requireUser(user), dto, requestId);
  }

  @ApiBearerAuth()
  @RequirePermissions('unit:manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar unidade (inclusive ativar ou desativar)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<UnitView> {
    return this.units.update(requireUser(user), id, dto, requestId);
  }

  @ApiBearerAuth()
  @RequirePermissions('schedule:manage')
  @Get(':id/schedule-rules')
  @ApiOperation({ summary: 'Grade semanal da unidade' })
  rules(@Param('id', new ParseUUIDPipe()) id: string): Promise<ScheduleRuleView[]> {
    return this.units.rules(id);
  }

  @ApiBearerAuth()
  @RequirePermissions('schedule:manage')
  @Put(':id/schedule-rules')
  @ApiOperation({ summary: 'Substituir a grade semanal da unidade' })
  replaceRules(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReplaceScheduleRulesDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<ScheduleRuleView[]> {
    return this.units.replaceRules(requireUser(user), id, dto, requestId);
  }

  @ApiBearerAuth()
  @RequirePermissions('schedule:manage')
  @Get(':id/blocks')
  @ApiOperation({ summary: 'Bloqueios atuais e futuros da agenda da unidade' })
  blocks(@Param('id', new ParseUUIDPipe()) id: string): Promise<ScheduleBlockView[]> {
    return this.units.blocks(id);
  }

  @ApiBearerAuth()
  @RequirePermissions('schedule:manage')
  @Post(':id/blocks')
  @ApiOperation({ summary: 'Bloquear um período (agendamentos já marcados continuam válidos)' })
  createBlock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateScheduleBlockDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<ScheduleBlockView> {
    return this.units.createBlock(requireUser(user), id, dto, requestId);
  }

  @ApiBearerAuth()
  @RequirePermissions('schedule:manage')
  @Delete(':id/blocks/:blockId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remover um bloqueio' })
  @ApiNoContentResponse()
  deleteBlock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('blockId', new ParseUUIDPipe()) blockId: string,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<void> {
    return this.units.deleteBlock(requireUser(user), id, blockId, requestId);
  }
}

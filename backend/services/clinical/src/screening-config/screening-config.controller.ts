import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type {
  AuthUser,
  ScreeningConfigView,
  ScreeningFieldView,
  ScreeningRuleView,
} from '@pulso/contracts';
import {
  CreateFieldDto,
  UpdateFieldDto,
  UpdateQuestionDto,
  UpdateRuleDto,
} from './dto/screening-config.dto';
import { ScreeningConfigService } from './screening-config.service';

@ApiTags('Administração — pré-triagem e triagem')
@ApiBearerAuth()
@RequirePermissions('settings:manage')
@Controller('screening-config')
export class ScreeningConfigController {
  constructor(private readonly config: ScreeningConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Conjunto de regras vigente: perguntas e regras (com status de validação)',
  })
  view(): Promise<ScreeningConfigView> {
    return this.config.view();
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Editar texto/ajuda de uma pergunta ou ativá-la/desativá-la' })
  updateQuestion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<ScreeningConfigView> {
    return this.config.updateQuestion(requireUser(user), id, dto, requestId);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Editar a orientação de uma regra ou ativá-la/desativá-la' })
  updateRule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRuleDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<ScreeningRuleView> {
    return this.config.updateRule(requireUser(user), id, dto, requestId);
  }

  @Get('fields')
  @ApiOperation({ summary: 'Campos da triagem profissional (inclusive inativos)' })
  fields(): Promise<ScreeningFieldView[]> {
    return this.config.fields();
  }

  @Post('fields')
  @ApiOperation({
    summary: 'Criar campo da triagem profissional (sem limiares clínicos automáticos)',
  })
  createField(
    @Body() dto: CreateFieldDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<ScreeningFieldView> {
    return this.config.createField(requireUser(user), dto, requestId);
  }

  @Patch('fields/:id')
  @ApiOperation({ summary: 'Editar campo da triagem profissional (código e tipo são fixos)' })
  updateField(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFieldDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<ScreeningFieldView> {
    return this.config.updateField(requireUser(user), id, dto, requestId);
  }
}

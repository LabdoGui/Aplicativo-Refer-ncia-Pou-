import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppException,
  CurrentUser,
  Public,
  RequestId,
  RequirePermissions,
  requireUser,
} from '@pulso/common';
import { hasPermission, type AuthUser, type CampaignView } from '@pulso/contracts';
import { IncludeInactiveQueryDto } from '../units/dto/units.dto';
import { CampaignsService } from './campaigns.service';
import { CampaignInputDto, UpdateCampaignDto } from './dto/campaigns.dto';

@ApiTags('Campanhas')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Campanhas vigentes (todas, só para a administração)' })
  list(
    @Query() query: IncludeInactiveQueryDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<CampaignView[]> {
    const includeInactive = query.includeInactive === 'true';
    if (includeInactive && !(user && hasPermission(user.role, 'campaign:manage'))) {
      throw new AppException(
        403,
        'FORBIDDEN',
        'Só a administração vê campanhas encerradas ou inativas.',
      );
    }
    return this.campaigns.list(includeInactive);
  }

  @ApiBearerAuth()
  @RequirePermissions('campaign:manage')
  @Post()
  @ApiOperation({ summary: 'Criar campanha' })
  create(
    @Body() dto: CampaignInputDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<CampaignView> {
    return this.campaigns.create(requireUser(user), dto, requestId);
  }

  @ApiBearerAuth()
  @RequirePermissions('campaign:manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar campanha (inclusive encerrar)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<CampaignView> {
    return this.campaigns.update(requireUser(user), id, dto, requestId);
  }
}

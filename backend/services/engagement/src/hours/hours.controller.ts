import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AuthUser, InstitutionView, MyHoursResponse } from '@pulso/contracts';
import { SetInstitutionDto } from './dto/set-institution.dto';
import { HoursService } from './hours.service';

@ApiTags('Horas complementares')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly hours: HoursService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Instituições de ensino parceiras ativas (fictícias)' })
  list(): Promise<InstitutionView[]> {
    return this.hours.activeInstitutions();
  }
}

@ApiTags('Horas complementares')
@ApiBearerAuth()
@RequirePermissions('self:gamification')
@Controller('complementary-hours')
export class ComplementaryHoursController {
  constructor(private readonly hours: HoursService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Pedidos de horas do doador e totais por situação',
    description: 'As horas só valem depois de aprovadas pela instituição de ensino (RN15).',
  })
  mine(@CurrentUser() user?: AuthUser): Promise<MyHoursResponse> {
    return this.hours.myHours(requireUser(user).id);
  }

  @Put('institution')
  @ApiOperation({
    summary: 'Vincular (ou desvincular) a instituição de ensino',
    description: 'Vale para as próximas doações; pedidos já criados não mudam de instituição.',
  })
  setInstitution(
    @Body() dto: SetInstitutionDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<MyHoursResponse> {
    return this.hours.setInstitution(requireUser(user), dto, requestId);
  }
}

import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AuthUser, ClinicalSettingsView } from '@pulso/contracts';
import { UpdateClinicalSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Configurações clínicas')
@ApiBearerAuth()
@RequirePermissions('settings:manage')
@Controller('clinical-settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Intervalo entre doações e validade da pré-triagem' })
  async get(): Promise<ClinicalSettingsView> {
    return this.settings.view(await this.settings.get());
  }

  @Patch()
  @ApiOperation({
    summary: 'Alterar as configurações (o intervalo continua pendente de validação profissional)',
  })
  update(
    @Body() dto: UpdateClinicalSettingsDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<ClinicalSettingsView> {
    return this.settings.update(requireUser(user), dto, requestId);
  }
}

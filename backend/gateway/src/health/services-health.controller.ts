import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestId } from '@pulso/common';
import { API_PREFIX } from '@pulso/contracts';
import { ServicesHealthDto } from './services-health.dto';
import { ServicesHealthService } from './services-health.service';

@ApiTags('Saúde')
@Controller(`${API_PREFIX}/health`)
export class ServicesHealthController {
  constructor(private readonly health: ServicesHealthService) {}

  /**
   * Estado de cada serviço do back-end e das dependências dele (banco e broker).
   * Responde 200 mesmo com serviços fora do ar: o campo `status` indica a situação.
   */
  @Get('services')
  @ApiOperation({ summary: 'Estado dos serviços' })
  @ApiOkResponse({ type: ServicesHealthDto })
  services(@RequestId() requestId?: string): Promise<ServicesHealthDto> {
    return this.health.check(requestId);
  }
}

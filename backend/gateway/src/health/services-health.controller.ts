import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG, Public, RequestId, SERVICE_NAME } from '@pulso/common';
import { API_PREFIX } from '@pulso/contracts';
import type { GatewayEnv } from '../config';
import { GatewayHealthDto, ServicesHealthDto } from './services-health.dto';
import { ServicesHealthService } from './services-health.service';

@ApiTags('Saúde')
@Public()
@Controller(`${API_PREFIX}/health`)
export class ServicesHealthController {
  constructor(
    private readonly health: ServicesHealthService,
    @Inject(SERVICE_NAME) private readonly serviceName: string,
    @Inject(APP_CONFIG) private readonly config: GatewayEnv,
  ) {}

  /**
   * O gateway está no ar (não consulta os serviços). O Docker usa o GET /health da raiz,
   * que não passa pelo nginx; esta rota é a mesma verificação com o prefixo /api/v1.
   */
  @Get()
  @ApiOperation({ summary: 'Gateway no ar' })
  @ApiOkResponse({ type: GatewayHealthDto })
  liveness(): GatewayHealthDto {
    return {
      status: 'up',
      service: this.serviceName,
      version: this.config.SERVICE_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      checks: {},
    };
  }

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

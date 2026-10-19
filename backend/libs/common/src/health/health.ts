import {
  Controller,
  DynamicModule,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Res,
  Type,
} from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { HealthCheckResult } from '@pulso/contracts';
import { Public } from '../auth/decorators';
import { APP_CONFIG, HEALTH_INDICATORS, PRISMA_CLIENT, SERVICE_NAME } from '../tokens';
import type { BaseEnv } from '../config/env';

export interface HealthIndicator {
  readonly name: string;
  isHealthy(): Promise<boolean>;
}

interface RawQueryable {
  $queryRawUnsafe(query: string): Promise<unknown>;
}

/** Verifica a conexão com o PostgreSQL usando o cliente Prisma do serviço. */
@Injectable()
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'database';

  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: RawQueryable) {}

  async isHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

@ApiTags('Saúde')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    @Inject(SERVICE_NAME) private readonly serviceName: string,
    @Inject(APP_CONFIG) private readonly config: BaseEnv,
    @Inject(HEALTH_INDICATORS) private readonly indicators: HealthIndicator[],
  ) {}

  @Public()
  @Get()
  @HttpCode(200)
  @ApiOkResponse({ description: 'Serviço e dependências disponíveis' })
  @ApiServiceUnavailableResponse({ description: 'Alguma dependência está indisponível' })
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthCheckResult> {
    const results = await Promise.all(
      this.indicators.map(
        async (indicator) => [indicator.name, await indicator.isHealthy()] as const,
      ),
    );
    const checks = Object.fromEntries(
      results.map(([name, healthy]) => [name, healthy ? 'up' : 'down']),
    ) as Record<string, 'up' | 'down'>;
    const status = results.every(([, healthy]) => healthy) ? 'up' : 'down';
    if (status === 'down') response.status(503);
    return {
      status,
      service: this.serviceName,
      version: this.config.SERVICE_VERSION,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      checks,
    };
  }
}

@Module({})
export class HealthModule {
  /**
   * Registra GET /health com os indicadores informados.
   * Exemplo: HealthModule.forRoot([DatabaseHealthIndicator, BrokerHealthIndicator])
   */
  static forRoot(indicators: Type<HealthIndicator>[] = []): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [
        ...indicators,
        {
          provide: HEALTH_INDICATORS,
          useFactory: (...instances: HealthIndicator[]) => instances,
          inject: indicators,
        },
      ],
    };
  }
}

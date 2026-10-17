import { ApiProperty } from '@nestjs/swagger';
import { SERVICE_NAMES, type HealthCheckResult, type ServiceName } from '@pulso/contracts';

export type ComponentStatus = 'up' | 'down';
export type OverallStatus = 'up' | 'degraded' | 'down';

export class ServiceHealthDto {
  /** Identificador técnico do serviço. */
  @ApiProperty({ enum: SERVICE_NAMES, example: 'identity' })
  name: ServiceName;

  /** Nome amigável do serviço. */
  @ApiProperty({ example: 'Identidade e acesso' })
  title: string;

  /** `up` quando o serviço respondeu e todas as dependências dele estão disponíveis. */
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status: ComponentStatus;

  /** Versão informada pelo serviço (`null` se ele não respondeu). */
  @ApiProperty({ type: String, nullable: true, example: '0.1.0' })
  version: string | null;

  /** Estado de cada dependência do serviço (banco, broker...). */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', enum: ['up', 'down'] },
    example: { database: 'up', broker: 'up' },
  })
  checks: Record<string, ComponentStatus>;

  /** Tempo de resposta do health check, em milissegundos (`null` se não respondeu). */
  @ApiProperty({ type: Number, nullable: true, example: 12 })
  latencyMs: number | null;
}

export class GatewayHealthDto implements HealthCheckResult {
  /** `up` quando o gateway está respondendo. */
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status: ComponentStatus;

  /** Nome do processo. */
  @ApiProperty({ example: 'gateway' })
  service: string;

  /** Versão do gateway. */
  @ApiProperty({ example: '0.1.0' })
  version: string;

  /** Tempo desde o início do processo, em segundos. */
  @ApiProperty({ example: 3600 })
  uptimeSeconds: number;

  /** Dependências verificadas (nenhuma: o estado dos serviços está em /health/services). */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', enum: ['up', 'down'] },
    example: {},
  })
  checks: Record<string, ComponentStatus>;
}

export class ServicesHealthDto {
  /** `up`: todos disponíveis; `degraded`: parte deles; `down`: nenhum. */
  @ApiProperty({ enum: ['up', 'degraded', 'down'], example: 'degraded' })
  status: OverallStatus;

  /** Momento da verificação (ISO 8601). */
  @ApiProperty({ format: 'date-time' })
  checkedAt: string;

  @ApiProperty({ type: [ServiceHealthDto] })
  services: ServiceHealthDto[];
}

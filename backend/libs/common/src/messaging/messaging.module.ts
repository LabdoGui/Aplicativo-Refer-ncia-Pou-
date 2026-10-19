import { DynamicModule, Global, Module } from '@nestjs/common';
import { BrokerConnection, BrokerHealthIndicator, EventPublisher } from './broker';
import { EventConsumer } from './consumer';
import { OutboxRelay, OutboxService } from './outbox';

export interface MessagingModuleOptions {
  /**
   * Publica eventos pelo outbox transacional (padrão: true). Serviços que só
   * consomem eventos não têm a tabela `outbox_events` e usam `false`.
   */
  outbox?: boolean;
}

/**
 * Conexão com o broker, publicação de eventos, outbox transacional e consumidor
 * idempotente. Requer um provider PRISMA_CLIENT global (PrismaModule do serviço).
 */
@Global()
@Module({})
export class MessagingModule {
  static forRoot(options: MessagingModuleOptions = {}): DynamicModule {
    const providers = [
      BrokerConnection,
      BrokerHealthIndicator,
      EventConsumer,
      ...(options.outbox === false ? [] : [EventPublisher, OutboxRelay, OutboxService]),
    ];
    return { module: MessagingModule, providers, exports: providers };
  }
}

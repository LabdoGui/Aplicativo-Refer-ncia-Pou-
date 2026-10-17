import { DynamicModule, Global, Module } from '@nestjs/common';
import { BrokerConnection, BrokerHealthIndicator, EventPublisher } from './broker';
import { EventConsumer } from './consumer';
import { OutboxRelay, OutboxService } from './outbox';

/**
 * Conexão com o broker, publicação de eventos, outbox transacional e consumidor
 * idempotente. Requer um provider PRISMA_CLIENT global (PrismaModule do serviço).
 */
@Global()
@Module({})
export class MessagingModule {
  static forRoot(): DynamicModule {
    const providers = [
      BrokerConnection,
      EventPublisher,
      BrokerHealthIndicator,
      OutboxRelay,
      OutboxService,
      EventConsumer,
    ];
    return { module: MessagingModule, providers, exports: providers };
  }
}

import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_CONFIG, PRISMA_CLIENT, SERVICE_NAME } from '../tokens';
import { AuditModule, AuditService } from '../audit/audit';
import { EventConsumer } from './consumer';
import { MessagingModule } from './messaging.module';
import { OutboxRelay, OutboxService } from './outbox';

/** Providers que, num serviço, vêm do CoreModule e do PrismaModule. */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useValue: { RABBITMQ_URL: 'amqp://localhost' } },
    { provide: SERVICE_NAME, useValue: 'teste-service' },
    { provide: PRISMA_CLIENT, useValue: {} },
  ],
  exports: [APP_CONFIG, SERVICE_NAME, PRISMA_CLIENT],
})
class FakeCoreModule {}

describe('MessagingModule e AuditModule', () => {
  it('resolvem as dependências (sem importações circulares)', async () => {
    // compile() resolve a injeção sem rodar onModuleInit (não abre conexão com o broker).
    const moduleRef = await Test.createTestingModule({
      imports: [FakeCoreModule, MessagingModule.forRoot(), AuditModule.forRoot()],
    }).compile();
    expect(moduleRef.get(OutboxService)).toBeInstanceOf(OutboxService);
    expect(moduleRef.get(OutboxRelay)).toBeInstanceOf(OutboxRelay);
    expect(moduleRef.get(EventConsumer)).toBeInstanceOf(EventConsumer);
    expect(moduleRef.get(AuditService)).toBeInstanceOf(AuditService);
  });

  it('sem outbox, registra só a conexão e o consumidor', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeCoreModule, MessagingModule.forRoot({ outbox: false })],
    }).compile();
    expect(moduleRef.get(EventConsumer)).toBeInstanceOf(EventConsumer);
    expect(() => moduleRef.get(OutboxRelay)).toThrow();
  });
});

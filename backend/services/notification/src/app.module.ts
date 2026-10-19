import { Module } from '@nestjs/common';
import {
  BrokerHealthIndicator,
  CoreModule,
  DatabaseHealthIndicator,
  HealthModule,
  DeletedAccountsModule,
  MessagingModule,
} from '@pulso/common';
import { envSchema } from './config';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { SeedService } from './seed/seed.service';

@Module({
  imports: [
    CoreModule.forRoot({ serviceName: 'notification-service', envSchema }),
    PrismaModule,
    DeletedAccountsModule.forRoot(),
    // Só consome eventos: sem tabela outbox_events e sem OutboxRelay.
    MessagingModule.forRoot({ outbox: false }),
    HealthModule.forRoot([DatabaseHealthIndicator, BrokerHealthIndicator]),
    NotificationsModule,
  ],
  providers: [SeedService],
})
export class AppModule {}

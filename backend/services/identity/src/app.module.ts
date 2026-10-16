import { Module } from '@nestjs/common';
import {
  BrokerHealthIndicator,
  CoreModule,
  DatabaseHealthIndicator,
  HealthModule,
  MessagingModule,
} from '@pulso/common';
import { envSchema } from './config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    CoreModule.forRoot({ serviceName: 'identity-service', envSchema }),
    PrismaModule,
    MessagingModule.forRoot(),
    HealthModule.forRoot([DatabaseHealthIndicator, BrokerHealthIndicator]),
  ],
})
export class AppModule {}

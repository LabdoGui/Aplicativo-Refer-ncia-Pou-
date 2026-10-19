import { Module } from '@nestjs/common';
import {
  AuditModule,
  BrokerHealthIndicator,
  CoreModule,
  DatabaseHealthIndicator,
  HealthModule,
  MessagingModule,
} from '@pulso/common';
import { envSchema } from './config';
import { InternalController } from './internal/internal.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SeedService } from './seed/seed.service';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [
    CoreModule.forRoot({ serviceName: 'inventory-service', envSchema }),
    PrismaModule,
    MessagingModule.forRoot(),
    AuditModule.forRoot(),
    HealthModule.forRoot([DatabaseHealthIndicator, BrokerHealthIndicator]),
    StockModule,
  ],
  controllers: [InternalController],
  providers: [SeedService],
})
export class AppModule {}

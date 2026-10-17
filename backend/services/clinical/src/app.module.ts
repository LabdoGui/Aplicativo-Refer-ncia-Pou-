import { Module } from '@nestjs/common';
import {
  AuditModule,
  BrokerHealthIndicator,
  CoreModule,
  DatabaseHealthIndicator,
  HealthModule,
  MessagingModule,
} from '@pulso/common';
import { AttendancesModule } from './attendances/attendances.module';
import { envSchema } from './config';
import { CryptoModule } from './crypto/crypto.module';
import { DocumentsModule } from './documents/documents.module';
import { DonationsModule } from './donations/donations.module';
import { InternalController } from './internal/internal.controller';
import { PreScreeningModule } from './pre-screening/pre-screening.module';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulingClientModule } from './scheduling/scheduling.module';
import { ScreeningConfigModule } from './screening-config/screening-config.module';
import { SeedService } from './seed/seed.service';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    CoreModule.forRoot({ serviceName: 'clinical-service', envSchema }),
    PrismaModule,
    MessagingModule.forRoot(),
    AuditModule.forRoot(),
    HealthModule.forRoot([DatabaseHealthIndicator, BrokerHealthIndicator]),
    CryptoModule,
    SettingsModule,
    SchedulingClientModule,
    PreScreeningModule,
    AttendancesModule,
    DonationsModule,
    DocumentsModule,
    ScreeningConfigModule,
  ],
  controllers: [InternalController],
  providers: [SeedService],
})
export class AppModule {}

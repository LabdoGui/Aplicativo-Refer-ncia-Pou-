import { Module } from '@nestjs/common';
import {
  AuditModule,
  BrokerHealthIndicator,
  CoreModule,
  DatabaseHealthIndicator,
  HealthModule,
  MessagingModule,
} from '@pulso/common';
import { AdminCatalogService } from './admin/admin-catalog.service';
import {
  AdminGamificationController,
  AdminHoursController,
  AdminInstitutionsController,
} from './admin/admin.controller';
import { AdminHoursService } from './admin/admin-hours.service';
import { SettingsService } from './catalog/settings.service';
import { envSchema } from './config';
import { GamificationController } from './gamification/gamification.controller';
import { GamificationService } from './gamification/gamification.service';
import { ComplementaryHoursController, InstitutionsController } from './hours/hours.controller';
import { HoursService } from './hours/hours.service';
import { IdentityClient } from './identity/identity.client';
import { InternalController } from './internal/internal.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UserDeletedHandler } from './privacy/user-deleted.handler';
import { ProgressConsumer } from './progress/progress.consumer';
import { ProgressService } from './progress/progress.service';
import { SeedService } from './seed/seed.service';

@Module({
  imports: [
    CoreModule.forRoot({ serviceName: 'engagement-service', envSchema }),
    PrismaModule,
    MessagingModule.forRoot(),
    AuditModule.forRoot(),
    HealthModule.forRoot([DatabaseHealthIndicator, BrokerHealthIndicator]),
  ],
  controllers: [
    GamificationController,
    InstitutionsController,
    ComplementaryHoursController,
    AdminHoursController,
    AdminInstitutionsController,
    AdminGamificationController,
    InternalController,
  ],
  providers: [
    SettingsService,
    ProgressService,
    ProgressConsumer,
    UserDeletedHandler,
    GamificationService,
    HoursService,
    AdminHoursService,
    AdminCatalogService,
    IdentityClient,
    SeedService,
  ],
})
export class AppModule {}

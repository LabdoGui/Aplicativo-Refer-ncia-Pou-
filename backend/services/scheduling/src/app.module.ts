import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import {
  AuditModule,
  BrokerHealthIndicator,
  CoreModule,
  DatabaseHealthIndicator,
  HealthModule,
  MessagingModule,
} from '@pulso/common';
import { AdminAppointmentsController } from './admin/admin-appointments.controller';
import { AdminAppointmentsService } from './admin/admin-appointments.service';
import { AgendaController } from './agenda/agenda.controller';
import { AgendaService } from './agenda/agenda.service';
import { AppointmentsController } from './appointments/appointments.controller';
import { AppointmentsService } from './appointments/appointments.service';
import { AvailabilityService } from './appointments/availability.service';
import { CampaignsController } from './campaigns/campaigns.controller';
import { CampaignsService } from './campaigns/campaigns.service';
import { envSchema } from './config';
import { AttendanceCompletedHandler } from './events/attendance-completed.handler';
import { DonorDirectory } from './identity/donor-directory';
import { InternalController } from './internal/internal.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ReminderJob } from './reminders/reminder.job';
import { SeedService } from './seed/seed.service';
import { UnitsController } from './units/units.controller';
import { UnitsService } from './units/units.service';

@Module({
  imports: [
    CoreModule.forRoot({ serviceName: 'scheduling-service', envSchema }),
    PrismaModule,
    MessagingModule.forRoot(),
    AuditModule.forRoot(),
    HealthModule.forRoot([DatabaseHealthIndicator, BrokerHealthIndicator]),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    UnitsController,
    AppointmentsController,
    AgendaController,
    AdminAppointmentsController,
    CampaignsController,
    InternalController,
  ],
  providers: [
    UnitsService,
    AvailabilityService,
    AppointmentsService,
    AgendaService,
    AdminAppointmentsService,
    CampaignsService,
    DonorDirectory,
    AttendanceCompletedHandler,
    ReminderJob,
    SeedService,
  ],
})
export class AppModule {}

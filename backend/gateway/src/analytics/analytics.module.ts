import { Module } from '@nestjs/common';
import { UpstreamsModule } from '../upstreams/upstreams.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { InternalSources } from './internal-sources';

/** Rotas de composição do gateway: dashboard, números públicos e auditoria unificada. */
@Module({
  imports: [UpstreamsModule],
  controllers: [DashboardController, AuditLogsController],
  providers: [InternalSources, DashboardService, AuditLogsService],
})
export class AnalyticsModule {}

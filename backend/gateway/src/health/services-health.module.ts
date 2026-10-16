import { Module } from '@nestjs/common';
import { UpstreamsModule } from '../upstreams/upstreams.module';
import { ServicesHealthController } from './services-health.controller';
import { ServicesHealthService } from './services-health.service';

@Module({
  imports: [UpstreamsModule],
  controllers: [ServicesHealthController],
  providers: [ServicesHealthService],
})
export class ServicesHealthModule {}

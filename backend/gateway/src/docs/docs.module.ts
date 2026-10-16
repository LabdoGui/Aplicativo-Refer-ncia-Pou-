import { Module } from '@nestjs/common';
import { UpstreamsModule } from '../upstreams/upstreams.module';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';

@Module({
  imports: [UpstreamsModule],
  controllers: [DocsController],
  providers: [DocsService],
  exports: [DocsService],
})
export class DocsModule {}

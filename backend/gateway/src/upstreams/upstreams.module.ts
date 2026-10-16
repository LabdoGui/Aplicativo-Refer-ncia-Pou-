import { Module } from '@nestjs/common';
import { APP_CONFIG } from '@pulso/common';
import type { GatewayEnv } from '../config';
import { buildUpstreams, UPSTREAMS } from './upstreams';

@Module({
  providers: [
    {
      provide: UPSTREAMS,
      useFactory: (config: GatewayEnv) => buildUpstreams(config),
      inject: [APP_CONFIG],
    },
  ],
  exports: [UPSTREAMS],
})
export class UpstreamsModule {}

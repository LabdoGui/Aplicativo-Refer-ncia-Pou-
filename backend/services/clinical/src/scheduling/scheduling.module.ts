import { Global, Module } from '@nestjs/common';
import { SchedulingClient } from './scheduling.client';

@Global()
@Module({ providers: [SchedulingClient], exports: [SchedulingClient] })
export class SchedulingClientModule {}

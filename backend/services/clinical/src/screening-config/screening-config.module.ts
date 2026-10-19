import { Module } from '@nestjs/common';
import { ScreeningConfigController } from './screening-config.controller';
import { ScreeningConfigService } from './screening-config.service';

@Module({ controllers: [ScreeningConfigController], providers: [ScreeningConfigService] })
export class ScreeningConfigModule {}

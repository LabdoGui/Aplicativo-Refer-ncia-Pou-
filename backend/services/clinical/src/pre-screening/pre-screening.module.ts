import { Module } from '@nestjs/common';
import { PreScreeningController } from './pre-screening.controller';
import { PreScreeningService } from './pre-screening.service';

@Module({
  controllers: [PreScreeningController],
  providers: [PreScreeningService],
  exports: [PreScreeningService],
})
export class PreScreeningModule {}

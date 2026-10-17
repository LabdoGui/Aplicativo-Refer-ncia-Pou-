import { Module } from '@nestjs/common';
import { PreScreeningModule } from '../pre-screening/pre-screening.module';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';

@Module({
  imports: [PreScreeningModule],
  controllers: [AttendancesController],
  providers: [AttendancesService],
})
export class AttendancesModule {}

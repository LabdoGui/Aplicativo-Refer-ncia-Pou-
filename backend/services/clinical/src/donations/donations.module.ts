import { Module } from '@nestjs/common';
import { AdminDonationsController, DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  controllers: [DonationsController, AdminDonationsController],
  providers: [DonationsService],
})
export class DonationsModule {}

import { Module } from '@nestjs/common';
import { MovementsService } from './movements.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController],
  providers: [StockService, MovementsService],
})
export class StockModule {}

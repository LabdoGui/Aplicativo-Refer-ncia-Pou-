import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser, Public, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type {
  AuthUser,
  MovementView,
  Paginated,
  PublicStockLevel,
  StockHistoryResponse,
  StockItemView,
  StockOverview,
} from '@pulso/contracts';
import {
  BloodTypeParamDto,
  CreateMovementDto,
  HistoryQueryDto,
  MovementsQueryDto,
  UpdateThresholdsDto,
} from './dto/stock.dto';
import { MovementsService } from './movements.service';
import { StockService } from './stock.service';

@ApiTags('Banco de sangue')
@Controller('blood-inventory')
export class StockController {
  constructor(
    private readonly stock: StockService,
    private readonly movements: MovementsService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @RequirePermissions('inventory:read')
  @ApiOperation({
    summary: 'Estoque central por tipo sanguíneo, com status, tendência e minissérie',
  })
  @ApiOkResponse({ description: 'Os 8 tipos, na ordem A+, A−, B+, B−, AB+, AB−, O+, O−' })
  @ApiForbiddenResponse({ description: 'Sem permissão de leitura do estoque' })
  overview(): Promise<StockOverview> {
    return this.stock.overview();
  }

  @Public()
  @Get('public')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Níveis públicos do estoque (só o status, sem quantidades)' })
  publicLevels(): Promise<PublicStockLevel[]> {
    return this.stock.publicLevels();
  }

  @Get('history')
  @ApiBearerAuth()
  @RequirePermissions('inventory:read')
  @ApiOperation({
    summary: 'Saldo no fim de cada dia (7 a 90 dias), reconstruído pelas movimentações',
  })
  history(@Query() query: HistoryQueryDto): Promise<StockHistoryResponse> {
    return this.stock.history(query.days ?? 30);
  }

  @Get('movements')
  @ApiBearerAuth()
  @RequirePermissions('inventory:read')
  @ApiOperation({
    summary: 'Histórico de movimentações (filtros por tipo sanguíneo, tipo e período)',
  })
  listMovements(@Query() query: MovementsQueryDto): Promise<Paginated<MovementView>> {
    return this.movements.list(query);
  }

  @Post('movements')
  @ApiBearerAuth()
  @RequirePermissions('inventory:move')
  @ApiOperation({ summary: 'Registrar entrada ou saída de bolsas' })
  @ApiCreatedResponse({ description: 'Movimentação registrada e saldo atualizado' })
  @ApiUnprocessableEntityResponse({ description: 'Saída maior que o estoque disponível' })
  createMovement(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<MovementView> {
    return this.movements.create(requireUser(user), dto, requestId);
  }

  @Patch(':bloodType/thresholds')
  @ApiBearerAuth()
  @RequirePermissions('inventory:move')
  @ApiOperation({ summary: 'Ajustar os níveis mínimo e ideal de um tipo sanguíneo' })
  updateThresholds(
    @Param() params: BloodTypeParamDto,
    @Body() dto: UpdateThresholdsDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<StockItemView> {
    return this.stock.updateThresholds(requireUser(user), params.bloodType, dto, requestId);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AppointmentView, AuthUser, AvailabilityResponse } from '@pulso/contracts';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService } from './availability.service';
import {
  AvailabilityQueryDto,
  CancelAppointmentDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
} from './dto/appointments.dto';

@ApiTags('Agendamentos (doador)')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  // Rotas fixas antes de ":id".
  @Public()
  @Get('availability')
  @ApiOperation({ summary: 'Vagas por dia de uma unidade (lotadas vêm com remaining = 0)' })
  availability(@Query() query: AvailabilityQueryDto): Promise<AvailabilityResponse> {
    return this.availabilityService.availability(query);
  }

  @ApiBearerAuth()
  @RequirePermissions('self:appointments')
  @Get('me')
  @ApiOperation({ summary: 'Meus agendamentos (mais recentes primeiro)' })
  mine(@CurrentUser() user?: AuthUser): Promise<AppointmentView[]> {
    return this.appointments.listMine(requireUser(user).id);
  }

  @ApiBearerAuth()
  @RequirePermissions('self:appointments')
  @Post()
  @ApiOperation({ summary: 'Agendar doação (1 agendamento ativo por doador)' })
  @ApiCreatedResponse({ description: 'Agendamento criado' })
  book(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AppointmentView> {
    return this.appointments.book(requireUser(user), dto, requestId);
  }

  @ApiBearerAuth()
  @RequirePermissions('self:appointments')
  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um agendamento meu' })
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<AppointmentView> {
    return this.appointments.getMine(requireUser(user).id, id);
  }

  @ApiBearerAuth()
  @RequirePermissions('self:appointments')
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar (até 2 horas antes do horário)' })
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AppointmentView> {
    return this.appointments.cancel(requireUser(user), id, dto, requestId);
  }

  @ApiBearerAuth()
  @RequirePermissions('self:appointments')
  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reagendar (cancela o atual e cria um novo, numa só operação)' })
  reschedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AppointmentView> {
    return this.appointments.reschedule(requireUser(user), id, dto, requestId);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AdminAppointmentItem, AuthUser, Paginated } from '@pulso/contracts';
import { AppointmentsService } from '../appointments/appointments.service';
import { AdminAppointmentsService } from './admin-appointments.service';
import { AdminAppointmentsQueryDto, AdminCancelAppointmentDto } from './dto/admin-appointments.dto';

@ApiTags('Administração — agendamentos')
@ApiBearerAuth()
@RequirePermissions('appointment:manage')
@Controller('admin/appointments')
export class AdminAppointmentsController {
  constructor(
    private readonly admin: AdminAppointmentsService,
    private readonly appointments: AppointmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Agendamentos de todas as unidades (filtros e paginação)' })
  list(
    @Query() query: AdminAppointmentsQueryDto,
    @RequestId() requestId?: string,
  ): Promise<Paginated<AdminAppointmentItem>> {
    return this.admin.list(query, requestId);
  }

  @Patch(':id/cancel')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancelar pela unidade (motivo obrigatório; o doador é notificado)' })
  @ApiNoContentResponse()
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminCancelAppointmentDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<void> {
    return this.appointments.cancelByStaff(requireUser(user), id, dto.reason, requestId);
  }
}

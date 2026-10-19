import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AgendaResponse, AuthUser, StaffAppointmentView } from '@pulso/contracts';
import { AgendaService } from './agenda.service';
import { AgendaQueryDto } from './dto/agenda.dto';

@ApiTags('Agenda da equipe')
@ApiBearerAuth()
@Controller()
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @RequirePermissions('agenda:read')
  @Get('agenda')
  @ApiOperation({
    summary: 'Agendamentos do dia de uma unidade (equipe da unidade ou administração)',
  })
  agenda(
    @Query() query: AgendaQueryDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AgendaResponse> {
    return this.agendaService.agenda(requireUser(user), query, requestId);
  }

  @RequirePermissions('agenda:read')
  @Get('agenda/appointments/:id')
  @ApiOperation({ summary: 'Detalhe do agendamento com o resumo do doador (sem dados clínicos)' })
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<StaffAppointmentView> {
    return this.agendaService.staffView(requireUser(user), id, requestId);
  }

  @RequirePermissions('appointment:check-in')
  @Patch('appointments/:id/check-in')
  @ApiOperation({ summary: 'Registrar chegada do doador (só no dia do agendamento)' })
  checkIn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<StaffAppointmentView> {
    return this.agendaService.checkIn(requireUser(user), id, requestId);
  }

  @RequirePermissions('appointment:check-in')
  @Patch('appointments/:id/no-show')
  @ApiOperation({ summary: 'Registrar falta (depois do horário agendado)' })
  noShow(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<StaffAppointmentView> {
    return this.agendaService.noShow(requireUser(user), id, requestId);
  }
}

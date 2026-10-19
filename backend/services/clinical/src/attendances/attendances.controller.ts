import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type {
  AttendanceStaffView,
  AuthUser,
  ScreeningFieldView,
  SharedPreScreeningView,
} from '@pulso/contracts';
import { AttendancesService } from './attendances.service';
import { ProfessionalScreeningDto } from './dto/attendance.dto';

@ApiTags('Atendimento (triagem profissional)')
@ApiBearerAuth()
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendances: AttendancesService) {}

  @Get('fields')
  @RequirePermissions('screening:perform')
  @ApiOperation({ summary: 'Campos configurados da triagem profissional' })
  fields(): Promise<ScreeningFieldView[]> {
    return this.attendances.activeFields();
  }

  @Get('appointment/:appointmentId')
  @RequirePermissions('screening:perform')
  @ApiOperation({ summary: 'Atendimento registrado para o agendamento' })
  @ApiOkResponse({ description: 'Atendimento já registrado' })
  @ApiNoContentResponse({ description: 'Triagem ainda não registrada' })
  async byAppointment(
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AttendanceStaffView | undefined> {
    const view = await this.attendances.byAppointment(requireUser(user), appointmentId, requestId);
    if (!view) response.status(204);
    return view ?? undefined;
  }

  @Get('appointment/:appointmentId/pre-screening')
  @RequirePermissions('prescreening:read-shared')
  @ApiOperation({
    summary: 'Pré-triagem que o doador escolheu compartilhar com a unidade (acesso auditado)',
  })
  @ApiNoContentResponse({ description: 'Nenhuma pré-triagem compartilhada' })
  async preScreening(
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<SharedPreScreeningView | undefined> {
    const view = await this.attendances.sharedPreScreening(
      requireUser(user),
      appointmentId,
      requestId,
    );
    if (!view) response.status(204);
    return view ?? undefined;
  }

  @Post()
  @RequirePermissions('screening:perform')
  @ApiOperation({
    summary:
      'Registrar a triagem profissional (resultado definido pelo profissional). Sem aptidão, o atendimento é finalizado.',
  })
  record(
    @Body() dto: ProfessionalScreeningDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AttendanceStaffView> {
    return this.attendances.record(requireUser(user), dto, requestId);
  }
}

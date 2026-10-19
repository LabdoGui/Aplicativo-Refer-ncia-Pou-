import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type {
  AdminDonationItem,
  AttendanceStaffView,
  AuthUser,
  DonorAttendanceView,
  EligibilityView,
  Paginated,
} from '@pulso/contracts';
import { DonationsService } from './donations.service';
import { AdminDonationsQueryDto, RecordDonationDto } from './dto/donation.dto';

@ApiTags('Doações')
@ApiBearerAuth()
@Controller('donations')
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Post()
  @RequirePermissions('donation:record')
  @ApiOperation({ summary: 'Registrar a doação de um atendimento com triagem apta' })
  record(
    @Body() dto: RecordDonationDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AttendanceStaffView> {
    return this.donations.record(requireUser(user), dto, requestId);
  }

  @Get('history')
  @RequirePermissions('self:donations')
  @ApiOperation({ summary: 'Meus atendimentos e doações (sem dados da triagem)' })
  history(@CurrentUser() user?: AuthUser): Promise<DonorAttendanceView[]> {
    return this.donations.history(requireUser(user));
  }

  @Get('history/:attendanceId')
  @RequirePermissions('self:donations')
  @ApiOperation({ summary: 'Um atendimento meu (tela de agradecimento e detalhe)' })
  attendance(
    @Param('attendanceId', new ParseUUIDPipe()) attendanceId: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<DonorAttendanceView> {
    return this.donations.attendance(requireUser(user), attendanceId);
  }

  @Get('eligibility')
  @RequirePermissions('self:donations')
  @ApiOperation({
    summary: 'Data informativa da próxima doação (intervalo configurado, pendente de validação)',
  })
  eligibility(@CurrentUser() user?: AuthUser): Promise<EligibilityView> {
    return this.donations.eligibility(requireUser(user));
  }
}

@ApiTags('Administração — doações')
@ApiBearerAuth()
@RequirePermissions('donation:read-all')
@Controller('admin/donations')
export class AdminDonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Get()
  @ApiOperation({ summary: 'Doações registradas (filtros por período, unidade, tipo e status)' })
  list(@Query() query: AdminDonationsQueryDto): Promise<Paginated<AdminDonationItem>> {
    return this.donations.adminList(query);
  }
}

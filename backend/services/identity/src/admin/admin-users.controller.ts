import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AdminUserView, AuthUser, Paginated } from '@pulso/contracts';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersQueryDto, CreateStaffUserDto, UpdateUserDto } from './dto/admin-users.dto';

@ApiTags('Administração — usuários')
@ApiBearerAuth()
@RequirePermissions('user:manage')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar doadores e profissionais (busca e filtros)' })
  list(@Query() query: AdminUsersQueryDto): Promise<Paginated<AdminUserView>> {
    return this.users.list(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar conta de profissional (colaborador, enfermeiro ou administrador)',
  })
  create(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AdminUserView> {
    return this.users.create(requireUser(user), dto, requestId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar papel, unidades ou status de uma conta' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<AdminUserView> {
    return this.users.update(requireUser(user), id, dto, requestId);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Patch, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser, RequestId, requireUser } from '@pulso/common';
import type { AuthUser, ConsentView, MeResponse, PersonalDataExport } from '@pulso/contracts';
import { clearRefreshCookie, readRefreshCookie } from '../auth/session-cookie';
import { AuthService } from '../auth/auth.service';
import { AccountService } from './account.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateConsentsDto,
  UpdateMeDto,
} from './dto/account.dto';

@ApiTags('Minha conta')
@ApiBearerAuth()
@Controller()
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
  ) {}

  @Get('users/me')
  @ApiOperation({ summary: 'Dados da conta e do perfil de doador' })
  me(@CurrentUser() user?: AuthUser): Promise<MeResponse> {
    return this.account.me(requireUser(user).id);
  }

  @Patch('users/me')
  @ApiOperation({ summary: 'Atualizar nome e dados do perfil' })
  update(
    @Body() dto: UpdateMeDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<MeResponse> {
    return this.account.updateMe(requireUser(user), dto, requestId);
  }

  @Patch('users/me/password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Trocar a senha (encerra as sessões de outros dispositivos)' })
  @ApiNoContentResponse()
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<void> {
    return this.account.changePassword(
      requireUser(user),
      dto,
      readRefreshCookie(request),
      requestId,
    );
  }

  @Get('users/me/export')
  @ApiOperation({ summary: 'Cópia dos dados pessoais (LGPD, art. 18)' })
  export(
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<PersonalDataExport> {
    return this.account.exportData(requireUser(user), requestId);
  }

  @Delete('users/me')
  @HttpCode(204)
  @ApiOperation({ summary: 'Excluir a conta (anonimiza os dados de identificação)' })
  @ApiNoContentResponse()
  async delete(
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<void> {
    await this.account.deleteAccount(requireUser(user), dto.password, requestId);
    clearRefreshCookie(response, this.auth.cookieSecure);
  }

  @Get('consents/me')
  @ApiOperation({ summary: 'Consentimentos e seus estados' })
  consents(@CurrentUser() user?: AuthUser): Promise<ConsentView[]> {
    return this.account.consents(requireUser(user).id);
  }

  @Put('consents/me')
  @ApiOperation({ summary: 'Conceder ou revogar consentimentos opcionais' })
  updateConsents(
    @Body() dto: UpdateConsentsDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<ConsentView[]> {
    return this.account.updateConsents(requireUser(user), dto, requestId);
  }
}

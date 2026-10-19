import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public, RequestId } from '@pulso/common';
import type { AuthSession } from '@pulso/contracts';
import { AuthService, type IssuedSession } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './session-cookie';

@ApiTags('Autenticação')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cadastro de doador (maiores de 18 anos), já autenticado' })
  @ApiCreatedResponse({ description: 'Conta criada; refresh token no cookie httpOnly' })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @RequestId() requestId?: string,
  ): Promise<AuthSession> {
    return this.respond(await this.auth.register(dto, this.context(request, requestId)), response);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Entrar com e-mail e senha' })
  @ApiOkResponse({ description: 'Access token no corpo; refresh token no cookie httpOnly' })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha incorretos' })
  @ApiTooManyRequestsResponse({ description: 'Conta bloqueada temporariamente' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @RequestId() requestId?: string,
  ): Promise<AuthSession> {
    return this.respond(await this.auth.login(dto, this.context(request, requestId)), response);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar a sessão (usa e rotaciona o cookie do refresh token)' })
  @ApiOkResponse({ description: 'Novo access token e novo cookie' })
  @ApiUnauthorizedResponse({ description: 'Sessão expirada ou revogada' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @RequestId() requestId?: string,
  ): Promise<AuthSession> {
    try {
      const issued = await this.auth.refresh(
        readRefreshCookie(request),
        this.context(request, requestId),
      );
      return this.respond(issued, response);
    } catch (error) {
      if ((error as { code?: string }).code !== 'REFRESH_RACE') {
        clearRefreshCookie(response, this.auth.cookieSecure);
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sair (revoga a sessão deste dispositivo)' })
  @ApiNoContentResponse()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @RequestId() requestId?: string,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request), this.context(request, requestId));
    clearRefreshCookie(response, this.auth.cookieSecure);
  }

  private respond(issued: IssuedSession, response: Response): AuthSession {
    setRefreshCookie(
      response,
      issued.refreshToken,
      this.auth.refreshTokenTtlMs,
      this.auth.cookieSecure,
    );
    return issued.session;
  }

  private context(request: Request, requestId?: string) {
    return { userAgent: request.header('user-agent'), requestId };
  }
}

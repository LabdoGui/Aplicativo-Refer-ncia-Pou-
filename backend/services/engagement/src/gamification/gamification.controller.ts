import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestId, RequirePermissions, requireUser } from '@pulso/common';
import type { AuthUser, GamificationProfile, RankingResponse } from '@pulso/contracts';
import { RankingOptInDto } from './dto/ranking-opt-in.dto';
import { GamificationService } from './gamification.service';

@ApiTags('Gamificação')
@ApiBearerAuth()
@RequirePermissions('self:gamification')
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Pontos, nível, conquistas e últimos lançamentos do doador' })
  profile(@CurrentUser() user?: AuthUser): Promise<GamificationProfile> {
    return this.gamification.profile(requireUser(user).id);
  }

  @Get('ranking')
  @ApiOperation({
    summary: 'Ranking dos 10 primeiros (só quem optou por participar, por apelido)',
    description:
      'Empates dividem a posição (1, 2, 2, 4). `me` traz a posição de quem consulta, se participar.',
  })
  ranking(@CurrentUser() user?: AuthUser): Promise<RankingResponse> {
    return this.gamification.ranking(requireUser(user).id);
  }

  @Put('ranking/opt-in')
  @ApiOperation({ summary: 'Entrar ou sair do ranking (com apelido; nunca dados de saúde)' })
  @ApiConflictResponse({ description: 'Apelido já em uso' })
  optIn(
    @Body() dto: RankingOptInDto,
    @CurrentUser() user?: AuthUser,
    @RequestId() requestId?: string,
  ): Promise<GamificationProfile> {
    return this.gamification.setRankingOptIn(requireUser(user), dto, requestId);
  }
}

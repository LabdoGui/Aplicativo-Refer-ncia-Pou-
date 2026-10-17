import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, requireUser } from '@pulso/common';
import type { AuthUser, NotificationView, Paginated, UnreadCountResponse } from '@pulso/contracts';
import { ListNotificationsQueryDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificações')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Minhas notificações (mais recentes primeiro)' })
  list(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Paginated<NotificationView>> {
    return this.notifications.list(requireUser(user).id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Quantidade de notificações não lidas' })
  unreadCount(@CurrentUser() user?: AuthUser): Promise<UnreadCountResponse> {
    return this.notifications.unreadCount(requireUser(user).id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas como lidas' })
  markAllRead(@CurrentUser() user?: AuthUser): Promise<{ count: number }> {
    return this.notifications.markAllRead(requireUser(user).id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar uma notificação como lida' })
  @ApiNotFoundResponse({ description: 'Notificação inexistente ou de outra pessoa' })
  markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<NotificationView> {
    return this.notifications.markRead(requireUser(user).id, id);
  }
}

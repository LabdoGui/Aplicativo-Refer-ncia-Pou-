import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AppException, pageParams, paginated } from '@pulso/common';
import type { NotificationView, Paginated, UnreadCountResponse } from '@pulso/contracts';
import type { Notification } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { ListNotificationsQueryDto } from './dto/list-notifications.dto';

/** Notificações lidas há mais tempo que isso são apagadas pela limpeza diária. */
export const READ_RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60_000;

export function toView(row: Notification): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationsService.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    this.cleanupTimer = setInterval(() => void this.cleanup(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.cleanupTimer);
  }

  async list(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<Paginated<NotificationView>> {
    const { skip, take, page, pageSize } = pageParams(query);
    const where = { userId, ...(query.onlyUnread === 'true' ? { readAt: null } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(rows.map(toView), total, page, pageSize);
  }

  async unreadCount(userId: string): Promise<UnreadCountResponse> {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  /** Marca como lida (idempotente). Notificação de outra pessoa → 404. */
  async markRead(userId: string, id: string): Promise<NotificationView> {
    const row = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw new AppException(404, 'NOTIFICATION_NOT_FOUND', 'Notificação não encontrada.');
    if (row.readAt) return toView(row);
    return toView(
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } }),
    );
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count };
  }

  /** Apaga notificações já lidas há mais de READ_RETENTION_DAYS (minimização, LGPD). */
  async cleanup(): Promise<void> {
    try {
      const { count } = await this.prisma.notification.deleteMany({
        where: { readAt: { lt: new Date(Date.now() - READ_RETENTION_DAYS * 86_400_000) } },
      });
      if (count > 0) this.logger.log({ count }, 'Notificações antigas removidas');
    } catch (error) {
      this.logger.warn({ err: error }, 'Falha na limpeza de notificações antigas');
    }
  }
}

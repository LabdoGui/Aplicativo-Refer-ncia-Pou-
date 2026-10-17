import { AppException } from '@pulso/common';
import { NotificationsService } from './notifications.service';

const USER = '6f1b0a52-3a52-4a8e-9d5e-0c4a9b1f2e11';
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'n1',
  userId: USER,
  type: 'WELCOME',
  title: 'Boas-vindas ao Pulso',
  body: 'Olá!',
  link: '/app',
  readAt: null,
  sourceEventId: null,
  createdAt: new Date('2026-10-17T12:00:00Z'),
  ...overrides,
});

function setup() {
  const prisma = {
    notification: {
      findMany: jest.fn(async () => [row()]),
      count: jest.fn(async () => 1),
      findFirst: jest.fn(),
      update: jest.fn(async () => row({ readAt: new Date() })),
      updateMany: jest.fn(async () => ({ count: 3 })),
    },
  };
  return { prisma, service: new NotificationsService(prisma as never) };
}

describe('NotificationsService', () => {
  it('lista só as próprias, filtrando não lidas quando onlyUnread=true', async () => {
    const { prisma, service } = setup();
    const page = await service.list(USER, { onlyUnread: 'true', page: 2, pageSize: 10 });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER, readAt: null }, skip: 10, take: 10 }),
    );
    expect(page).toMatchObject({ total: 1, page: 2, pageSize: 10 });
    expect(page.items[0].createdAt).toBe('2026-10-17T12:00:00.000Z');

    await service.list(USER, { onlyUnread: 'false' });
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: USER } }),
    );
  });

  it('notificação de outra pessoa responde 404', async () => {
    const { prisma, service } = setup();
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(service.markRead(USER, 'n1')).rejects.toBeInstanceOf(AppException);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'n1', userId: USER },
    });
  });

  it('marcar como lida é idempotente', async () => {
    const { prisma, service } = setup();
    prisma.notification.findFirst.mockResolvedValue(
      row({ readAt: new Date('2026-10-17T13:00:00Z') }),
    );
    const view = await service.markRead(USER, 'n1');
    expect(view.readAt).toBe('2026-10-17T13:00:00.000Z');
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marca todas as não lidas do usuário', async () => {
    const { prisma, service } = setup();
    await expect(service.markAllRead(USER)).resolves.toEqual({ count: 3 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: USER, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

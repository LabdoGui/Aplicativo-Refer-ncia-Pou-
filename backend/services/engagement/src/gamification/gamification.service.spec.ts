import { GamificationService } from './gamification.service';

describe('GamificationService.profile', () => {
  it('mantém visível a conquista desativada que o doador já desbloqueou', async () => {
    const donor = {
      donorId: 'd1',
      totalPoints: 100,
      attendanceCount: 1,
      donationCount: 1,
      campaignDonationCount: 0,
      lastAttendanceAt: null,
    };
    const prisma = {
      donorEngagement: {
        createMany: jest.fn(async () => ({ count: 0 })),
        findUniqueOrThrow: jest.fn(async () => donor),
      },
      donorAchievement: {
        findMany: jest.fn(async () => [
          { achievementCode: 'FIRST_DONATION', unlockedAt: new Date('2026-10-19T12:00:00Z') },
        ]),
      },
      achievement: { findMany: jest.fn(async () => []) },
      pointsEntry: { findMany: jest.fn(async () => []) },
    };
    const settings = { get: jest.fn(async () => ({ pointsBasis: 'ATTENDANCE' })) };
    const service = new GamificationService(prisma as never, settings as never, {} as never);
    await service.profile('d1');
    expect(prisma.achievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ active: true }, { code: { in: ['FIRST_DONATION'] } }] },
      }),
    );
  });
});

import { AnswersRetentionJob } from './answers-retention.job';

describe('AnswersRetentionJob', () => {
  it('apaga as respostas compartilhadas já vencidas', async () => {
    const prisma = { preScreening: { updateMany: jest.fn(async () => ({ count: 2 })) } };
    const job = new AnswersRetentionJob(prisma as never);
    const now = new Date('2026-12-01T06:15:00Z');
    await expect(job.purgeExpired(now)).resolves.toBe(2);
    expect(prisma.preScreening.updateMany).toHaveBeenCalledWith({
      where: { answersEncrypted: { not: null }, expiresAt: { lt: now } },
      data: { answersEncrypted: null, sharedWithStaff: false },
    });
  });
});

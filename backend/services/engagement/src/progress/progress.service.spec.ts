import { ACHIEVEMENT_CATALOG, DEFAULT_SETTINGS } from '../catalog/catalog';
import type { SettingsService } from '../catalog/settings.service';
import { ProgressService } from './progress.service';

const DONOR = '7c1f3c2a-9d4e-4b6a-8f1e-2a3b4c5d6e7f';

function fakeTx(
  state: Record<string, unknown>,
  institution: { id: string; active: boolean; hoursPerDonation: number } | null,
) {
  return {
    $executeRaw: jest.fn(async () => 1),
    $queryRaw: jest.fn(async () => [state]),
    achievement: {
      findMany: jest.fn(async () => ACHIEVEMENT_CATALOG.map((a) => ({ ...a, active: true }))),
    },
    donorAchievement: {
      findMany: jest.fn(async () => []),
      createMany: jest.fn(async () => ({ count: 1 })),
    },
    pointsEntry: { createMany: jest.fn(async () => ({ count: 1 })) },
    donorEngagement: { update: jest.fn(async () => ({})) },
    partnerInstitution: { findUnique: jest.fn(async () => institution) },
    complementaryHours: { createMany: jest.fn(async () => ({ count: 1 })) },
    engagementSettings: { findUnique: jest.fn() },
  };
}

const counters = {
  totalPoints: 100,
  attendanceCount: 1,
  donationCount: 0,
  campaignDonationCount: 0,
  lastAttendanceAt: null,
};

describe('ProgressService', () => {
  const settings = { get: jest.fn(async () => DEFAULT_SETTINGS) } as unknown as SettingsService;
  const service = new ProgressService(settings);
  const input = {
    donorId: DONOR,
    donationId: 'f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b',
    campaignId: 'c1',
    occurredAt: new Date('2026-10-17T11:30:00Z'),
    sourceEventId: '1c9d7a3e-5f7c-4b1a-9e2d-1c3f5a7b9d22',
  };

  it('na doação: trava a linha, conta, desbloqueia conquistas e cria horas pendentes', async () => {
    const tx = fakeTx(
      { ...counters, institutionId: 'i1' },
      { id: 'i1', active: true, hoursPerDonation: 4 },
    );
    const result = await service.recordDonation(tx as never, input);

    expect(String((tx.$queryRaw.mock.calls[0] as unknown[])[0])).toContain('FOR UPDATE');
    expect(tx.donorEngagement.update).toHaveBeenCalledWith({
      where: { donorId: DONOR },
      data: { totalPoints: 100, donationCount: 1, campaignDonationCount: 1 },
    });
    expect(result.unlocked.map((a) => a.code).sort()).toEqual([
      'CAMPAIGN_SPECIAL',
      'FIRST_DONATION',
    ]);
    expect(tx.complementaryHours.createMany).toHaveBeenCalledWith({
      data: [
        {
          donorId: DONOR,
          institutionId: 'i1',
          donationId: input.donationId,
          hours: 4,
          donatedAt: input.occurredAt,
        },
      ],
      skipDuplicates: true,
    });
    expect(result.hoursCreated).toBe(true);
    // Base ATTENDANCE: a doação não lança pontos.
    expect(tx.pointsEntry.createMany).not.toHaveBeenCalled();
  });

  it('não cria horas sem instituição ativa (RN15: nunca automático para quem não pediu)', async () => {
    const tx = fakeTx(
      { ...counters, institutionId: 'i1' },
      { id: 'i1', active: false, hoursPerDonation: 4 },
    );
    const result = await service.recordDonation(tx as never, input);
    expect(tx.complementaryHours.createMany).not.toHaveBeenCalled();
    expect(result.hoursCreated).toBe(false);
  });

  it('no comparecimento: lança os pontos com o id do evento e a data do fato', async () => {
    const tx = fakeTx({ ...counters, institutionId: null }, null);
    const result = await service.recordAttendance(tx as never, input);
    expect(result.pointsAwarded).toBe(200);
    expect(tx.pointsEntry.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          reason: 'RECURRING',
          points: 150,
          sourceEventId: input.sourceEventId,
          createdAt: input.occurredAt,
        }),
        expect.objectContaining({ reason: 'CAMPAIGN', points: 50 }),
      ],
      skipDuplicates: true,
    });
    expect(tx.donorEngagement.update).toHaveBeenCalledWith({
      where: { donorId: DONOR },
      data: { totalPoints: 300, attendanceCount: 2, lastAttendanceAt: input.occurredAt },
    });
  });
});

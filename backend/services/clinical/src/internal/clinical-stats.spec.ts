import { buildClinicalStats } from './clinical-stats';

describe('buildClinicalStats', () => {
  const stats = buildClinicalStats({
    from: '2026-10-01',
    to: '2026-10-03',
    donations: [
      {
        status: 'COMPLETED',
        bloodType: 'O_POS',
        volumeMl: 450,
        unitId: 'u1',
        unitName: 'Centro',
        occurredAt: new Date('2026-10-01T13:00:00Z'),
      },
      // 01h UTC do dia 3 = dia 2 em São Paulo
      {
        status: 'COMPLETED',
        bloodType: 'A_NEG',
        volumeMl: 450,
        unitId: 'u2',
        unitName: 'Norte',
        occurredAt: new Date('2026-10-03T01:00:00Z'),
      },
      {
        status: 'NOT_COMPLETED',
        bloodType: 'O_POS',
        volumeMl: 120,
        unitId: 'u1',
        unitName: 'Centro',
        occurredAt: new Date('2026-10-02T13:00:00Z'),
      },
    ],
    attendances: [{ result: 'FIT' }, { result: 'FIT' }, { result: 'UNFIT' }],
    preScreenings: [{ result: 'FAVORABLE' }, { result: 'WAIT_UNTIL' }],
  });

  it('conta doações concluídas, não concluídas e volume', () => {
    expect(stats.donationsCompleted).toBe(2);
    expect(stats.donationsNotCompleted).toBe(1);
    expect(stats.volumeMl).toBe(900);
    expect(stats.attendances).toBe(3);
  });

  it('agrupa por dia local, mês, tipo e unidade', () => {
    expect(stats.byDay).toEqual([
      { date: '2026-10-01', count: 1 },
      { date: '2026-10-02', count: 1 },
      { date: '2026-10-03', count: 0 },
    ]);
    expect(stats.byMonth).toEqual([{ month: '2026-10', count: 2 }]);
    expect(stats.byBloodType).toHaveLength(8);
    expect(stats.byBloodType.find((item) => item.bloodType === 'A_NEG')?.count).toBe(1);
    expect(stats.byUnit).toEqual([
      { unitId: 'u1', unitName: 'Centro', count: 1 },
      { unitId: 'u2', unitName: 'Norte', count: 1 },
    ]);
  });

  it('distribui resultados da triagem e da pré-triagem', () => {
    expect(stats.screeningOutcomes).toEqual([
      { result: 'FIT', count: 2 },
      { result: 'UNFIT', count: 1 },
      { result: 'NEEDS_EVALUATION', count: 0 },
    ]);
    expect(stats.preScreenings.find((item) => item.result === 'WAIT_UNTIL')?.count).toBe(1);
  });
});

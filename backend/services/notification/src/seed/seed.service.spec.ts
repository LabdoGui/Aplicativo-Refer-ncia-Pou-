import { SEED_IDS } from '@pulso/common';
import { buildSeedRows } from './seed.service';

describe('buildSeedRows', () => {
  const rows = buildSeedRows(new Date('2026-10-17T12:00:00Z'));

  it('gera a jornada da doadora de demonstração', () => {
    const donorTypes = rows.filter((r) => r.userId === SEED_IDS.users.donor).map((r) => r.type);
    expect(donorTypes).toEqual([
      'WELCOME',
      'DONATION_COMPLETED',
      'ACHIEVEMENT_UNLOCKED',
      'POINTS_AWARDED',
      'HOURS_REVIEWED',
    ]);
    const unread = rows.filter((r) => r.userId === SEED_IDS.users.donor && !r.readAt);
    expect(unread.map((r) => r.type)).toEqual(['POINTS_AWARDED', 'HOURS_REVIEWED']);
  });

  it('alerta o administrador para cada tipo crítico', () => {
    const alerts = rows.filter((r) => r.type === 'STOCK_ALERT');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((r) => r.userId === SEED_IDS.users.admin && !r.readAt)).toBe(true);
  });
});

import { nextEligibleDate } from './eligibility';

describe('nextEligibleDate', () => {
  it('soma o intervalo ao dia local da doação (fuso de São Paulo)', () => {
    // 01h UTC do dia 17 ainda é dia 16 em São Paulo (UTC−3).
    expect(nextEligibleDate(new Date('2026-10-17T01:00:00Z'), 90)).toBe('2027-01-14');
    expect(nextEligibleDate(new Date('2026-10-17T15:00:00Z'), 90)).toBe('2027-01-15');
  });

  it('respeita intervalos diferentes', () => {
    expect(nextEligibleDate(new Date('2026-01-31T12:00:00Z'), 30)).toBe('2026-03-02');
  });
});

import { campaignAppliesTo, dateOnly } from './campaigns.service';

const UNIT = '3c9911a0-c648-4537-a512-c12172bc808a';
const OTHER = 'f52f407d-2179-4e0d-bd5e-078a0c4e4637';
const campaign = (overrides = {}) => ({
  active: true,
  unitId: null as string | null,
  startsAt: dateOnly('2026-10-10'),
  endsAt: dateOnly('2026-10-20'),
  ...overrides,
});

describe('campaignAppliesTo', () => {
  it('vale dentro do período, inclusive nas datas limite', () => {
    expect(campaignAppliesTo(campaign(), UNIT, '2026-10-10')).toBe(true);
    expect(campaignAppliesTo(campaign(), UNIT, '2026-10-20')).toBe(true);
    expect(campaignAppliesTo(campaign(), UNIT, '2026-10-21')).toBe(false);
  });

  it('respeita a unidade da campanha (sem unidade = todas)', () => {
    expect(campaignAppliesTo(campaign({ unitId: UNIT }), UNIT, '2026-10-15')).toBe(true);
    expect(campaignAppliesTo(campaign({ unitId: UNIT }), OTHER, '2026-10-15')).toBe(false);
  });

  it('não vale se estiver inativa', () => {
    expect(campaignAppliesTo(campaign({ active: false }), UNIT, '2026-10-15')).toBe(false);
  });
});

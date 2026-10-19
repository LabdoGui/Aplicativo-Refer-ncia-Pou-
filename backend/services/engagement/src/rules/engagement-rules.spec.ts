import { levelFor, nextLevelFor } from '@pulso/contracts';
import {
  achievementProgress,
  applyAttendanceRules,
  applyDonationRules,
  describeAwards,
  EMPTY_COUNTERS,
  rankPositions,
  type AchievementRule,
  type RuleSettings,
} from './engagement-rules';

const ATTENDANCE: RuleSettings = {
  pointsBasis: 'ATTENDANCE',
  firstPoints: 100,
  recurringPoints: 150,
  campaignPoints: 50,
};
const DONATION: RuleSettings = { ...ATTENDANCE, pointsBasis: 'DONATION' };

const ACHIEVEMENTS: AchievementRule[] = [
  {
    code: 'FIRST_DONATION',
    name: 'Primeira Doação',
    criteria: 'DONATION_COUNT',
    threshold: 1,
    active: true,
  },
  {
    code: 'RECURRING_DONOR',
    name: 'Doador Recorrente',
    criteria: 'DONATION_COUNT',
    threshold: 2,
    active: true,
  },
  {
    code: 'THREE_DONATIONS',
    name: '3 Doações',
    criteria: 'DONATION_COUNT',
    threshold: 3,
    active: true,
  },
  {
    code: 'FIVE_DONATIONS',
    name: '5 Doações',
    criteria: 'DONATION_COUNT',
    threshold: 5,
    active: true,
  },
  {
    code: 'CAMPAIGN_SPECIAL',
    name: 'Campanha Especial',
    criteria: 'CAMPAIGN_DONATION',
    threshold: 1,
    active: true,
  },
];

describe('applyAttendanceRules (base ATTENDANCE, D4)', () => {
  it('dá +100 no primeiro comparecimento e +150 nos seguintes', () => {
    const first = applyAttendanceRules(EMPTY_COUNTERS, ATTENDANCE, { campaignId: null });
    expect(first.awards).toEqual([
      { reason: 'FIRST', points: 100, description: 'Primeiro comparecimento para doar' },
    ]);
    expect(first.counters).toMatchObject({ totalPoints: 100, attendanceCount: 1 });

    const second = applyAttendanceRules(first.counters, ATTENDANCE, { campaignId: null });
    expect(second.awards.map((a) => [a.reason, a.points])).toEqual([['RECURRING', 150]]);
    expect(second.counters).toMatchObject({ totalPoints: 250, attendanceCount: 2 });
  });

  it('soma +50 de campanha', () => {
    const outcome = applyAttendanceRules(EMPTY_COUNTERS, ATTENDANCE, { campaignId: 'c1' });
    expect(outcome.awards.map((a) => [a.reason, a.points])).toEqual([
      ['FIRST', 100],
      ['CAMPAIGN', 50],
    ]);
    expect(outcome.counters.totalPoints).toBe(150);
    expect(describeAwards(outcome.awards)).toBe(
      'Primeiro comparecimento para doar + Participação em campanha',
    );
  });

  it('não gera lançamento com pontuação zerada', () => {
    const outcome = applyAttendanceRules(
      EMPTY_COUNTERS,
      { ...ATTENDANCE, campaignPoints: 0 },
      {
        campaignId: 'c1',
      },
    );
    expect(outcome.awards.map((a) => a.reason)).toEqual(['FIRST']);
  });

  it('na base DONATION o comparecimento só conta, sem pontos', () => {
    const outcome = applyAttendanceRules(EMPTY_COUNTERS, DONATION, { campaignId: 'c1' });
    expect(outcome.awards).toEqual([]);
    expect(outcome.counters).toMatchObject({ totalPoints: 0, attendanceCount: 1 });
  });
});

describe('applyDonationRules', () => {
  it('libera as conquistas por número de doações, uma vez cada', () => {
    let counters = EMPTY_COUNTERS;
    const unlocked = new Set<string>();
    const sequence: string[][] = [];
    for (let i = 0; i < 5; i++) {
      const outcome = applyDonationRules(counters, ATTENDANCE, ACHIEVEMENTS, unlocked, {
        campaignId: null,
      });
      counters = outcome.counters;
      outcome.unlocked.forEach((rule) => unlocked.add(rule.code));
      sequence.push(outcome.unlocked.map((rule) => rule.code));
    }
    expect(sequence).toEqual([
      ['FIRST_DONATION'],
      ['RECURRING_DONOR'],
      ['THREE_DONATIONS'],
      [],
      ['FIVE_DONATIONS'],
    ]);
    expect(counters.donationCount).toBe(5);
  });

  it('libera a conquista de campanha com doação em campanha', () => {
    const outcome = applyDonationRules(EMPTY_COUNTERS, ATTENDANCE, ACHIEVEMENTS, new Set(), {
      campaignId: 'c1',
    });
    expect(outcome.unlocked.map((rule) => rule.code).sort()).toEqual([
      'CAMPAIGN_SPECIAL',
      'FIRST_DONATION',
    ]);
    expect(outcome.counters.campaignDonationCount).toBe(1);
  });

  it('ignora conquistas inativas e já obtidas', () => {
    const inactive = ACHIEVEMENTS.map((rule) =>
      rule.code === 'CAMPAIGN_SPECIAL' ? { ...rule, active: false } : rule,
    );
    const outcome = applyDonationRules(
      EMPTY_COUNTERS,
      ATTENDANCE,
      inactive,
      new Set(['FIRST_DONATION']),
      {
        campaignId: 'c1',
      },
    );
    expect(outcome.unlocked).toEqual([]);
  });

  it('na base ATTENDANCE a doação não dá pontos; na base DONATION dá', () => {
    expect(
      applyDonationRules(EMPTY_COUNTERS, ATTENDANCE, [], new Set(), { campaignId: null }).awards,
    ).toEqual([]);
    const donation = applyDonationRules(EMPTY_COUNTERS, DONATION, [], new Set(), {
      campaignId: 'c',
    });
    expect(donation.awards.map((a) => [a.reason, a.points, a.description])).toEqual([
      ['FIRST', 100, 'Primeira doação'],
      ['CAMPAIGN', 50, 'Participação em campanha'],
    ]);
    const recurring = applyDonationRules(donation.counters, DONATION, [], new Set(), {
      campaignId: null,
    });
    expect(recurring.awards.map((a) => [a.reason, a.points])).toEqual([['RECURRING', 150]]);
    expect(recurring.counters.totalPoints).toBe(300);
  });

  it('mostra o progresso limitado à meta', () => {
    const counters = { ...EMPTY_COUNTERS, donationCount: 7, campaignDonationCount: 0 };
    expect(achievementProgress(ACHIEVEMENTS[3], counters)).toEqual({ current: 5, target: 5 });
    expect(achievementProgress(ACHIEVEMENTS[4], counters)).toEqual({ current: 0, target: 1 });
  });
});

describe('níveis', () => {
  it('seguem as faixas de pontos: 1, 3 e 5 comparecimentos mudam de nível', () => {
    expect(levelFor(0).name).toBe('Primeiro Passo');
    expect(levelFor(100).name).toBe('Doador');
    expect(levelFor(399).name).toBe('Doador');
    expect(levelFor(400).name).toBe('Doador Frequente');
    expect(levelFor(700).name).toBe('Herói da Comunidade');
    expect(nextLevelFor(250)?.name).toBe('Doador Frequente');
    expect(nextLevelFor(5000)).toBeNull();
  });
});

describe('rankPositions', () => {
  it('usa posições de competição (empate divide a posição)', () => {
    const ranked = rankPositions([
      { donorId: 'a', nickname: 'A', totalPoints: 400 },
      { donorId: 'b', nickname: 'B', totalPoints: 250 },
      { donorId: 'c', nickname: 'C', totalPoints: 250 },
      { donorId: 'd', nickname: 'D', totalPoints: 100 },
    ]);
    expect(ranked.map((entry) => entry.position)).toEqual([1, 2, 2, 4]);
  });
});

/**
 * Regras puras da gamificação (sem banco). Usadas pelos consumidores de eventos
 * e pelo seed de demonstração, para que o histórico gravado e o comportamento
 * em produção nunca divirjam.
 *
 * D4: por padrão os pontos vêm do comparecimento (atendimento finalizado),
 * qualquer que seja o resultado da triagem (RN12); as conquistas contam
 * doações concluídas. Sem prêmios materiais (RN13).
 */
import {
  POINT_REASON_LABELS,
  type AchievementCriteria,
  type PointReason,
  type PointsBasis,
} from '@pulso/contracts';

export interface RuleSettings {
  pointsBasis: PointsBasis;
  firstPoints: number;
  recurringPoints: number;
  campaignPoints: number;
}

/** Contadores do doador que as regras leem e atualizam. */
export interface DonorCounters {
  totalPoints: number;
  attendanceCount: number;
  donationCount: number;
  campaignDonationCount: number;
}

export interface AchievementRule {
  code: string;
  name: string;
  criteria: AchievementCriteria;
  threshold: number;
  active: boolean;
}

export interface PointsAward {
  reason: PointReason;
  points: number;
  description: string;
}

export interface RuleOutcome {
  counters: DonorCounters;
  awards: PointsAward[];
}

export interface DonationOutcome extends RuleOutcome {
  /** Conquistas ativas que passaram a valer com esta doação. */
  unlocked: AchievementRule[];
}

export const EMPTY_COUNTERS: DonorCounters = {
  totalPoints: 0,
  attendanceCount: 0,
  donationCount: 0,
  campaignDonationCount: 0,
};

/** Pontos de primeira vez ou recorrência, mais o bônus de campanha (pontuações zeradas não geram lançamento). */
function pointsFor(
  settings: RuleSettings,
  previousCount: number,
  campaignId: string | null,
): PointsAward[] {
  const labels = POINT_REASON_LABELS[settings.pointsBasis];
  const awards: PointsAward[] = [
    previousCount === 0
      ? { reason: 'FIRST', points: settings.firstPoints, description: labels.FIRST }
      : { reason: 'RECURRING', points: settings.recurringPoints, description: labels.RECURRING },
  ];
  if (campaignId) {
    awards.push({
      reason: 'CAMPAIGN',
      points: settings.campaignPoints,
      description: labels.CAMPAIGN,
    });
  }
  return awards.filter((award) => award.points > 0);
}

function withPoints(counters: DonorCounters, awards: PointsAward[]): DonorCounters {
  return {
    ...counters,
    totalPoints: counters.totalPoints + awards.reduce((sum, award) => sum + award.points, 0),
  };
}

/** Atendimento finalizado (com ou sem doação). */
export function applyAttendanceRules(
  counters: DonorCounters,
  settings: RuleSettings,
  input: { campaignId: string | null },
): RuleOutcome {
  const awards =
    settings.pointsBasis === 'ATTENDANCE'
      ? pointsFor(settings, counters.attendanceCount, input.campaignId)
      : [];
  return {
    counters: withPoints({ ...counters, attendanceCount: counters.attendanceCount + 1 }, awards),
    awards,
  };
}

/** Progresso de uma conquista para os contadores informados. */
export function achievementProgress(
  rule: Pick<AchievementRule, 'criteria' | 'threshold'>,
  counters: DonorCounters,
): { current: number; target: number } {
  const value =
    rule.criteria === 'CAMPAIGN_DONATION' ? counters.campaignDonationCount : counters.donationCount;
  return { current: Math.min(value, rule.threshold), target: rule.threshold };
}

/** Doação concluída: contadores, conquistas e (na base DONATION) pontos. */
export function applyDonationRules(
  counters: DonorCounters,
  settings: RuleSettings,
  achievements: AchievementRule[],
  alreadyUnlocked: ReadonlySet<string>,
  input: { campaignId: string | null },
): DonationOutcome {
  const awards =
    settings.pointsBasis === 'DONATION'
      ? pointsFor(settings, counters.donationCount, input.campaignId)
      : [];
  const next = withPoints(
    {
      ...counters,
      donationCount: counters.donationCount + 1,
      campaignDonationCount: counters.campaignDonationCount + (input.campaignId ? 1 : 0),
    },
    awards,
  );
  const unlocked = achievements.filter((rule) => {
    if (!rule.active || alreadyUnlocked.has(rule.code)) return false;
    const { current, target } = achievementProgress(rule, next);
    return current >= target;
  });
  return { counters: next, awards, unlocked };
}

/** Texto do motivo para o evento de pontos (ex.: "Primeira doação + Participação em campanha"). */
export function describeAwards(awards: PointsAward[]): string {
  return awards.map((award) => award.description).join(' + ');
}

export interface RankingCandidate {
  donorId: string;
  nickname: string;
  totalPoints: number;
}

/**
 * Posições no estilo "competição" (1, 2, 2, 4): empatados dividem a posição e a
 * seguinte pula. A lista deve vir ordenada por pontos (desc) e desempate.
 */
export function rankPositions<T extends RankingCandidate>(
  sorted: T[],
): Array<T & { position: number }> {
  let position = 0;
  let previous: number | undefined;
  return sorted.map((candidate, index) => {
    if (candidate.totalPoints !== previous) {
      position = index + 1;
      previous = candidate.totalPoints;
    }
    return { ...candidate, position };
  });
}

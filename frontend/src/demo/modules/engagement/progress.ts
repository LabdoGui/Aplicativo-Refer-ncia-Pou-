/**
 * Estado do engagement-service e aplicação das regras puras da gamificação
 * (as mesmas do back-end) a esse estado: o equivalente ao ProgressService,
 * usado pelos consumidores de eventos e pelo seed.
 */
import type {
  AchievementCode,
  AchievementCriteria,
  HoursStatus,
  PointReason,
  PointsBasis,
} from '@pulso/contracts';
import {
  applyAttendanceRules,
  applyDonationRules,
  type AchievementRule,
  type DonorCounters,
  type PointsAward,
} from '@backend/services/engagement/src/rules/engagement-rules';
import { db } from '../../core/state';
import { nowIso, uuid } from '../../core/support';

export interface EngagementSettings {
  pointsBasis: PointsBasis;
  firstPoints: number;
  recurringPoints: number;
  campaignPoints: number;
  rankingEnabled: boolean;
}

export interface EngagementAchievement {
  code: AchievementCode;
  name: string;
  description: string;
  criteria: AchievementCriteria;
  threshold: number;
  active: boolean;
  order: number;
}

export interface EngagementDonor extends DonorCounters {
  donorId: string;
  lastAttendanceAt: string | null;
  rankingOptIn: boolean;
  nickname: string | null;
  institutionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementDonorAchievement {
  id: string;
  donorId: string;
  achievementCode: AchievementCode;
  sourceEventId: string | null;
  unlockedAt: string;
}

export interface EngagementPointsEntry {
  id: string;
  donorId: string;
  points: number;
  reason: PointReason;
  description: string;
  sourceEventId: string | null;
  createdAt: string;
}

export interface EngagementInstitution {
  id: string;
  name: string;
  hoursPerDonation: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementHours {
  id: string;
  donorId: string;
  institutionId: string;
  donationId: string;
  hours: number;
  status: HoursStatus;
  donatedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface EngagementState {
  settings: EngagementSettings;
  achievements: EngagementAchievement[];
  donors: EngagementDonor[];
  donorAchievements: EngagementDonorAchievement[];
  points: EngagementPointsEntry[];
  institutions: EngagementInstitution[];
  hours: EngagementHours[];
  /** Contas excluídas (identity.user.deleted): nada de pontos novos para elas. */
  deletedUsers: string[];
}

export const state = () => db().engagement;

export interface ProgressResult {
  awards: PointsAward[];
  pointsAwarded: number;
  totalPoints: number;
  unlocked: AchievementRule[];
  hoursCreated: boolean;
}

export interface AttendanceInput {
  donorId: string;
  campaignId: string | null;
  /** ISO */
  occurredAt: string;
  /** Id do evento de origem (idempotência dos lançamentos de pontos). */
  sourceEventId: string;
}

export interface DonationInput extends AttendanceInput {
  donationId: string;
}

/** Cria a linha do doador se faltar (sem pontos) e a devolve. */
export function ensureDonor(
  engagement: EngagementState,
  donorId: string,
  createdAt: string = nowIso(),
): EngagementDonor {
  let donor = engagement.donors.find((row) => row.donorId === donorId);
  if (!donor) {
    donor = {
      donorId,
      totalPoints: 0,
      attendanceCount: 0,
      donationCount: 0,
      campaignDonationCount: 0,
      lastAttendanceAt: null,
      rankingOptIn: false,
      nickname: null,
      institutionId: null,
      createdAt,
      updatedAt: createdAt,
    };
    engagement.donors.push(donor);
  }
  return donor;
}

/** Lançamentos de pontos, ignorando repetidos (chave única sourceEventId + motivo). */
function savePoints(engagement: EngagementState, input: AttendanceInput, awards: PointsAward[]) {
  for (const award of awards) {
    const duplicate = engagement.points.some(
      (entry) => entry.sourceEventId === input.sourceEventId && entry.reason === award.reason,
    );
    if (duplicate) continue;
    engagement.points.push({
      id: uuid(),
      donorId: input.donorId,
      points: award.points,
      reason: award.reason,
      description: award.description,
      sourceEventId: input.sourceEventId,
      createdAt: input.occurredAt,
    });
  }
}

function result(
  awards: PointsAward[],
  counters: DonorCounters,
  unlocked: AchievementRule[],
  hoursCreated: boolean,
): ProgressResult {
  return {
    awards,
    pointsAwarded: awards.reduce((sum, award) => sum + award.points, 0),
    totalPoints: counters.totalPoints,
    unlocked,
    hoursCreated,
  };
}

/** Atendimento finalizado (com ou sem doação): pontos na base ATTENDANCE (D4). */
export function recordAttendance(
  engagement: EngagementState,
  input: AttendanceInput,
  /** Data de criação da linha, se faltar (o seed usa o início da transação, como o back-end). */
  createdAt?: string,
): ProgressResult {
  const donor = ensureDonor(engagement, input.donorId, createdAt);
  const outcome = applyAttendanceRules(donor, engagement.settings, {
    campaignId: input.campaignId,
  });
  savePoints(engagement, input, outcome.awards);
  donor.totalPoints = outcome.counters.totalPoints;
  donor.attendanceCount = outcome.counters.attendanceCount;
  donor.lastAttendanceAt =
    donor.lastAttendanceAt && Date.parse(donor.lastAttendanceAt) > Date.parse(input.occurredAt)
      ? donor.lastAttendanceAt
      : input.occurredAt;
  donor.updatedAt = nowIso();
  return result(outcome.awards, outcome.counters, [], false);
}

/** Doação concluída: contadores, conquistas, pontos (base DONATION) e pedido de horas (RN15). */
export function recordDonation(
  engagement: EngagementState,
  input: DonationInput,
  createdAt?: string,
): ProgressResult {
  const donor = ensureDonor(engagement, input.donorId, createdAt);
  const achievements = [...engagement.achievements].sort((a, b) => a.order - b.order);
  const alreadyUnlocked = new Set(
    engagement.donorAchievements
      .filter((row) => row.donorId === input.donorId)
      .map((row) => row.achievementCode as string),
  );
  const outcome = applyDonationRules(donor, engagement.settings, achievements, alreadyUnlocked, {
    campaignId: input.campaignId,
  });

  savePoints(engagement, input, outcome.awards);
  donor.totalPoints = outcome.counters.totalPoints;
  donor.donationCount = outcome.counters.donationCount;
  donor.campaignDonationCount = outcome.counters.campaignDonationCount;
  donor.updatedAt = nowIso();
  for (const rule of outcome.unlocked) {
    engagement.donorAchievements.push({
      id: uuid(),
      donorId: input.donorId,
      achievementCode: rule.code as AchievementCode,
      sourceEventId: input.sourceEventId,
      unlockedAt: input.occurredAt,
    });
  }

  // RN15: o pedido de horas nasce pendente; só a instituição (via administrador) aprova.
  let hoursCreated = false;
  if (donor.institutionId) {
    const institution = engagement.institutions.find((row) => row.id === donor.institutionId);
    const exists = engagement.hours.some((row) => row.donationId === input.donationId);
    if (institution?.active && !exists) {
      engagement.hours.push({
        id: uuid(),
        donorId: input.donorId,
        institutionId: institution.id,
        donationId: input.donationId,
        hours: institution.hoursPerDonation,
        status: 'PENDING',
        donatedAt: input.occurredAt,
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: nowIso(),
      });
      hoursCreated = true;
    }
  }
  return result(outcome.awards, outcome.counters, outcome.unlocked, hoursCreated);
}

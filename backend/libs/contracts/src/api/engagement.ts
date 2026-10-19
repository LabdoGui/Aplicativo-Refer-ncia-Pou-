import type {
  AchievementCode,
  AchievementCriteria,
  HoursStatus,
  LevelCode,
  PointReason,
  PointsBasis,
} from '../domain';

export interface LevelView {
  code: LevelCode;
  name: string;
  minPoints: number;
}

export interface AchievementView {
  code: AchievementCode;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number };
}

export interface PointsEntryView {
  id: string;
  points: number;
  reason: PointReason;
  description: string;
  createdAt: string;
}

export interface GamificationProfile {
  totalPoints: number;
  level: LevelView;
  nextLevel: (LevelView & { pointsToGo: number }) | null;
  attendanceCount: number;
  donationCount: number;
  lastAttendanceAt: string | null;
  pointsBasis: PointsBasis;
  achievements: AchievementView[];
  recentPoints: PointsEntryView[];
  ranking: { enabled: boolean; optIn: boolean; nickname: string | null };
}

export interface RankingEntry {
  position: number;
  nickname: string;
  points: number;
  levelName: string;
  isMe: boolean;
}

export interface RankingResponse {
  enabled: boolean;
  entries: RankingEntry[];
  me: RankingEntry | null;
}

export interface RankingOptInRequest {
  optIn: boolean;
  nickname?: string;
}

export interface InstitutionView {
  id: string;
  name: string;
  hoursPerDonation: number;
  active: boolean;
}

export interface InstitutionInput {
  name: string;
  hoursPerDonation: number;
  active?: boolean;
}

export interface ComplementaryHoursView {
  id: string;
  institution: { id: string; name: string };
  hours: number;
  status: HoursStatus;
  donationId: string;
  donatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface MyHoursResponse {
  institution: InstitutionView | null;
  totals: Record<HoursStatus, number>;
  items: ComplementaryHoursView[];
}

export interface SetInstitutionRequest {
  institutionId: string | null;
}

export interface AdminHoursItem extends ComplementaryHoursView {
  donor: { id: string; name: string; donorCode: string | null };
}

export interface ReviewHoursRequest {
  status: 'APPROVED' | 'REJECTED';
  note?: string;
}

export interface GamificationSettingsView {
  pointsBasis: PointsBasis;
  firstPoints: number;
  recurringPoints: number;
  campaignPoints: number;
  rankingEnabled: boolean;
}

export type UpdateGamificationSettingsRequest = Partial<GamificationSettingsView>;

export interface AdminAchievementView {
  code: AchievementCode;
  name: string;
  description: string;
  criteria: AchievementCriteria;
  threshold: number;
  active: boolean;
  unlockedCount: number;
}

export interface UpdateAchievementRequest {
  name?: string;
  description?: string;
  active?: boolean;
}

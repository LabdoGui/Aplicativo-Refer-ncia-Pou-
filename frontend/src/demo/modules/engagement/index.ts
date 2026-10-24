/**
 * Módulo engagement da demonstração (espelho do engagement-service): pontos,
 * níveis, conquistas e ranking (D4, RN12, RN13, RN20), instituições parceiras e
 * horas complementares (D9, RN15).
 */
import {
  ACHIEVEMENT_CODES,
  EVENTS,
  HOURS_STATUSES,
  LEVELS,
  POINTS_BASES,
  levelFor,
  nextLevelFor,
  type AchievementCode,
  type AchievementUnlockedData,
  type AdminAchievementView,
  type AdminHoursItem,
  type AttendanceCompletedData,
  type ComplementaryHoursView,
  type DonationCompletedData,
  type EngagementStats,
  type GamificationProfile,
  type GamificationSettingsView,
  type HoursReviewedData,
  type HoursStatus,
  type InstitutionView,
  type MyHoursResponse,
  type PointsAwardedData,
  type RankingEntry,
  type RankingResponse,
  type StatsFilters,
  type UserDeletedData,
} from '@pulso/contracts';
import { SEED_IDS, seedUuid } from '@backend/libs/common/src/seed/dataset';
import {
  ACHIEVEMENT_CATALOG,
  DEFAULT_SETTINGS,
} from '@backend/services/engagement/src/catalog/catalog';
import {
  achievementProgress,
  describeAwards,
  rankPositions,
} from '@backend/services/engagement/src/rules/engagement-rules';
import { recordAudit } from '../../core/audit';
import { publish, subscribe, type EventMeta } from '../../core/events';
import { fail, route, type AuthedRequest } from '../../core/http';
import { internal } from '../../core/internal';
import type { SeedContext } from '../../core/state';
import { inRange, nowIso, paginate, statsRange, uuid } from '../../core/support';
import {
  ensureDonor,
  recordAttendance,
  recordDonation,
  state,
  type EngagementHours,
  type EngagementInstitution,
  type EngagementState,
  type ProgressResult,
} from './progress';
import {
  PAGINATION,
  bodyObject,
  isBoolean,
  isIn,
  isInt,
  isString,
  isUuidV4,
  matches,
  max,
  maxLength,
  min,
  minLength,
  parseUuid,
  queryObject,
  toBoolean,
  toNumber,
  trim,
  validate,
  withMessage,
} from './validation';

export type { EngagementState } from './progress';

const SERVICE = 'engagement';
/** Quantos participantes o ranking mostra. */
const RANKING_SIZE = 10;
/** Letras (inclusive acentuadas), números, espaço, ponto, sublinhado e hífen. */
const NICKNAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 ._-]+$/;
/** Pedidos com doação há mais que isso já foram revisados no histórico fictício. */
const REVIEWED_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;

// --- Seed ----------------------------------------------------------------------

/**
 * Mesmo seed do back-end: catálogo e parâmetros padrão e, com os dados de
 * demonstração, o histórico de atendimentos do dataset reproduzido pelas mesmas
 * regras dos consumidores (pontos e conquistas batem com o clinical).
 */
export function seedEngagement({ dataset }: SeedContext): EngagementState {
  const seededAt = nowIso();
  // Datas de criação das linhas dos doadores como no back-end, que desempatam o ranking:
  // as criadas pelo histórico (SQL now() = início da transação) vêm antes das vinculadas
  // a instituições (createMany), e as que só entram pelo ranking vêm por último.
  const start = Date.now();
  const historyCreatedAt = new Date(start).toISOString();
  const linkedCreatedAt = new Date(start + 1).toISOString();
  let optInCreatedAt = start + 2;
  const engagement: EngagementState = {
    settings: { ...DEFAULT_SETTINGS },
    achievements: ACHIEVEMENT_CATALOG.map((item) => ({ ...item, active: true })),
    donors: [],
    donorAchievements: [],
    points: [],
    institutions: dataset.institutions.map((item) => ({
      ...item,
      active: true,
      createdAt: seededAt,
      updatedAt: seededAt,
    })),
    hours: [],
    deletedUsers: [],
  };

  // Vínculos com instituições antes do histórico, para os pedidos de horas nascerem.
  for (const [donorId, institutionId] of Object.entries(dataset.donorInstitutions)) {
    ensureDonor(engagement, donorId, linkedCreatedAt).institutionId = institutionId;
  }

  for (const attendance of dataset.attendances) {
    recordAttendance(
      engagement,
      {
        donorId: attendance.donorId,
        campaignId: attendance.campaignId,
        occurredAt: attendance.attendedAt,
        sourceEventId: seedUuid(`event:attendance:${attendance.id}`),
      },
      historyCreatedAt,
    );
    if (attendance.donation?.status === 'COMPLETED') {
      recordDonation(
        engagement,
        {
          donorId: attendance.donorId,
          donationId: attendance.donation.id,
          campaignId: attendance.campaignId,
          occurredAt: attendance.donation.occurredAt,
          sourceEventId: seedUuid(`event:donation:${attendance.donation.id}`),
        },
        historyCreatedAt,
      );
    }
  }

  // Pedidos antigos já revisados; um recusado (de outro doador) para ilustrar.
  const cutoff = Date.now() - REVIEWED_AFTER_DAYS * DAY_MS;
  const hours = [...engagement.hours].sort(
    (a, b) => Date.parse(a.donatedAt) - Date.parse(b.donatedAt),
  );
  const rejected = hours.find(
    (row) => Date.parse(row.donatedAt) < cutoff && row.donorId !== SEED_IDS.users.donor,
  );
  for (const row of hours.filter((item) => Date.parse(item.donatedAt) < cutoff)) {
    const isRejected = row.id === rejected?.id;
    row.status = isRejected ? 'REJECTED' : 'APPROVED';
    row.reviewedById = SEED_IDS.users.admin;
    row.reviewedAt = new Date(Date.parse(row.donatedAt) + 5 * DAY_MS).toISOString();
    row.reviewNote = isRejected
      ? 'A instituição não reconheceu esta atividade para o semestre (exemplo fictício).'
      : null;
  }

  for (const { donorId, nickname } of dataset.rankingOptIns) {
    const donor = ensureDonor(engagement, donorId, new Date(optInCreatedAt++).toISOString());
    donor.rankingOptIn = true;
    donor.nickname = nickname;
  }
  return engagement;
}

// --- Gamificação do doador -------------------------------------------------------

function settingsView(): GamificationSettingsView {
  const { pointsBasis, firstPoints, recurringPoints, campaignPoints, rankingEnabled } =
    state().settings;
  return { pointsBasis, firstPoints, recurringPoints, campaignPoints, rankingEnabled };
}

function profile(donorId: string): GamificationProfile {
  const engagement = state();
  const donor = ensureDonor(engagement, donorId);
  const unlocked = engagement.donorAchievements.filter((row) => row.donorId === donorId);
  const unlockedAt = new Map(unlocked.map((row) => [row.achievementCode, row.unlockedAt]));
  // Conquista desativada some para quem ainda não tinha; quem já tinha continua vendo.
  const achievements = engagement.achievements
    .filter((achievement) => achievement.active || unlockedAt.has(achievement.code))
    .sort((a, b) => a.order - b.order);
  const recentPoints = engagement.points
    .filter((entry) => entry.donorId === donorId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 10);
  const level = levelFor(donor.totalPoints);
  const next = nextLevelFor(donor.totalPoints);

  return {
    totalPoints: donor.totalPoints,
    level: { code: level.code, name: level.name, minPoints: level.minPoints },
    nextLevel: next
      ? {
          code: next.code,
          name: next.name,
          minPoints: next.minPoints,
          pointsToGo: next.minPoints - donor.totalPoints,
        }
      : null,
    attendanceCount: donor.attendanceCount,
    donationCount: donor.donationCount,
    lastAttendanceAt: donor.lastAttendanceAt,
    pointsBasis: engagement.settings.pointsBasis,
    achievements: achievements.map((achievement) => ({
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      unlocked: unlockedAt.has(achievement.code),
      unlockedAt: unlockedAt.get(achievement.code) ?? null,
      progress: achievementProgress(achievement, donor),
    })),
    recentPoints: recentPoints.map((entry) => ({
      id: entry.id,
      points: entry.points,
      reason: entry.reason,
      description: entry.description,
      createdAt: entry.createdAt,
    })),
    ranking: {
      enabled: engagement.settings.rankingEnabled,
      optIn: donor.rankingOptIn,
      nickname: donor.nickname,
    },
  };
}

function toEntry(
  row: { donorId: string; nickname: string; totalPoints: number },
  position: number,
  viewerId: string,
): RankingEntry {
  return {
    position,
    nickname: row.nickname,
    points: row.totalPoints,
    levelName: levelFor(row.totalPoints).name,
    isMe: row.donorId === viewerId,
  };
}

/**
 * Top 10 de quem optou por participar, por pontos (desempate: quem entrou no
 * Pulso antes). Posições no estilo competição (1, 2, 2, 4).
 */
function ranking(donorId: string): RankingResponse {
  const engagement = state();
  if (!engagement.settings.rankingEnabled) return { enabled: false, entries: [], me: null };
  const participants = engagement.donors.filter((row) => row.rankingOptIn && row.nickname);
  // Ordenação estável: empates de pontos e de data seguem a ordem de criação.
  const top = [...participants]
    .sort(
      (a, b) => b.totalPoints - a.totalPoints || Date.parse(a.createdAt) - Date.parse(b.createdAt),
    )
    .slice(0, RANKING_SIZE);
  const entries = rankPositions(
    top.map((row) => ({
      donorId: row.donorId,
      nickname: row.nickname!,
      totalPoints: row.totalPoints,
    })),
  ).map((row) => toEntry(row, row.position, donorId));

  let me = entries.find((entry) => entry.isMe) ?? null;
  if (!me) {
    const own = engagement.donors.find((row) => row.donorId === donorId);
    if (own?.rankingOptIn && own.nickname) {
      const ahead = participants.filter((row) => row.totalPoints > own.totalPoints).length;
      me = toEntry(
        { nickname: own.nickname, totalPoints: own.totalPoints, donorId },
        ahead + 1,
        donorId,
      );
    }
  }
  return { enabled: true, entries, me };
}

function nicknameTaken(): never {
  return fail(409, 'NICKNAME_TAKEN', 'Este apelido já está em uso. Escolha outro.', undefined, [
    { field: 'nickname', message: 'Este apelido já está em uso.' },
  ]);
}

function setRankingOptIn(request: AuthedRequest): GamificationProfile {
  const actor = request.user;
  const dto = validate<{ optIn: boolean; nickname?: string }>(bodyObject(request.body), {
    optIn: { transform: toBoolean, rules: [isBoolean] },
    nickname: {
      when: (body) => body.optIn === true,
      transform: (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value),
      rules: [
        withMessage(isString, 'Informe um apelido para aparecer no ranking.'),
        minLength(3),
        maxLength(24),
        matches(NICKNAME_PATTERN, 'Use letras, números, espaços, ponto, hífen ou sublinhado.'),
      ],
    },
  });
  const engagement = state();
  const donor = ensureDonor(engagement, actor.id);
  const nickname = dto.optIn ? dto.nickname!.trim() : null;
  if (nickname) {
    const lower = nickname.toLowerCase();
    const taken = engagement.donors.some(
      (row) => row.donorId !== actor.id && row.nickname?.toLowerCase() === lower,
    );
    if (taken) nicknameTaken();
  }
  donor.rankingOptIn = dto.optIn;
  donor.nickname = nickname;
  donor.updatedAt = nowIso();
  // O apelido não vai para a auditoria: só a escolha.
  recordAudit(SERVICE, {
    actor,
    action: 'ranking.opt_in_changed',
    entity: 'donor_engagement',
    entityId: actor.id,
    metadata: { optIn: dto.optIn },
  });
  return profile(actor.id);
}

// --- Instituições e horas complementares ----------------------------------------

function toInstitutionView(row: EngagementInstitution): InstitutionView {
  return {
    id: row.id,
    name: row.name,
    hoursPerDonation: row.hoursPerDonation,
    active: row.active,
  };
}

function toHoursView(row: EngagementHours): ComplementaryHoursView {
  const institution = state().institutions.find((item) => item.id === row.institutionId);
  return {
    id: row.id,
    institution: { id: row.institutionId, name: institution?.name ?? '' },
    hours: row.hours,
    status: row.status,
    donationId: row.donationId,
    donatedAt: row.donatedAt,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
  };
}

/** Ordem alfabética do banco (collation com acentos). */
const byName = (a: EngagementInstitution, b: EngagementInstitution) =>
  a.name.localeCompare(b.name, 'pt-BR');

function activeInstitutions(): InstitutionView[] {
  return state()
    .institutions.filter((row) => row.active)
    .sort(byName)
    .map(toInstitutionView);
}

function myHours(donorId: string): MyHoursResponse {
  const engagement = state();
  const donor = ensureDonor(engagement, donorId);
  const institution = donor.institutionId
    ? engagement.institutions.find((row) => row.id === donor.institutionId)
    : undefined;
  const items = engagement.hours
    .filter((row) => row.donorId === donorId)
    .sort((a, b) => Date.parse(b.donatedAt) - Date.parse(a.donatedAt));
  const totals = Object.fromEntries(HOURS_STATUSES.map((status) => [status, 0])) as Record<
    HoursStatus,
    number
  >;
  for (const item of items) totals[item.status] += item.hours;
  return {
    institution: institution ? toInstitutionView(institution) : null,
    totals,
    items: items.map(toHoursView),
  };
}

function setInstitution(request: AuthedRequest): MyHoursResponse {
  const actor = request.user;
  const dto = validate<{ institutionId: string | null }>(bodyObject(request.body), {
    institutionId: {
      when: (body) => body.institutionId !== null,
      rules: [withMessage(isUuidV4, 'Selecione uma instituição da lista.')],
    },
  });
  const engagement = state();
  const donor = ensureDonor(engagement, actor.id);
  if (dto.institutionId) {
    const institution = engagement.institutions.find((row) => row.id === dto.institutionId);
    if (!institution?.active) {
      fail(
        422,
        'INSTITUTION_UNAVAILABLE',
        'Esta instituição não está disponível. Escolha outra da lista.',
        'Operação não permitida',
      );
    }
  }
  donor.institutionId = dto.institutionId;
  donor.updatedAt = nowIso();
  recordAudit(SERVICE, {
    actor,
    action: 'hours.institution_changed',
    entity: 'donor_engagement',
    entityId: actor.id,
    metadata: { institutionId: dto.institutionId },
  });
  return myHours(actor.id);
}

// --- Administração ------------------------------------------------------------------

type DonorName = AdminHoursItem['donor'];

/**
 * Nomes dos doadores (rota interna do identity). Se o identity falhar, a lista
 * continua utilizável: os nomes aparecem como indisponíveis.
 */
function donorNames(ids: string[]): Map<string, DonorName> {
  const unique = [...new Set(ids)];
  const result = new Map<string, DonorName>(
    unique.map((id) => [id, { id, name: 'Nome indisponível', donorCode: null }]),
  );
  if (unique.length === 0) return result;
  try {
    for (const summary of internal.identity.donorSummaries(unique)) {
      result.set(summary.id, {
        id: summary.id,
        name: summary.name,
        donorCode: summary.donorCode === '—' ? null : summary.donorCode,
      });
    }
  } catch (error) {
    console.warn('[demo] nomes dos doadores indisponíveis', error);
  }
  return result;
}

const STATUS_ORDER: Record<HoursStatus, number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };

function listHours(request: AuthedRequest) {
  const query = validate<{ status?: HoursStatus }>(queryObject(request.query), {
    status: { optional: true, rules: [isIn(HOURS_STATUSES)] },
    // Campos herdados (PaginationQueryDto) são validados depois dos próprios.
    ...PAGINATION,
  });
  // Pendentes mais antigos primeiro: a fila de revisão anda por ordem de chegada.
  const rows = state()
    .hours.filter((row) => !query.status || row.status === query.status)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
  const page = paginate(rows, request.query);
  const names = donorNames(page.items.map((row) => row.donorId));
  return {
    ...page,
    items: page.items.map((row) => ({ ...toHoursView(row), donor: names.get(row.donorId)! })),
  };
}

function reviewHours(request: AuthedRequest): AdminHoursItem {
  const actor = request.user;
  const id = parseUuid(request.params.id);
  const dto = validate<{ status: 'APPROVED' | 'REJECTED'; note?: string }>(
    bodyObject(request.body),
    {
      status: { rules: [isIn(['APPROVED', 'REJECTED'])] },
      note: { optional: true, transform: trim, rules: [isString, maxLength(300)] },
    },
  );
  const row = state().hours.find((item) => item.id === id);
  if (!row) fail(404, 'HOURS_NOT_FOUND', 'Pedido de horas não encontrado.');
  // Só pedidos pendentes.
  if (row.status !== 'PENDING') {
    fail(409, 'HOURS_ALREADY_REVIEWED', 'Este pedido de horas já foi revisado.');
  }
  row.status = dto.status;
  row.reviewNote = dto.note || null;
  row.reviewedById = actor.id;
  row.reviewedAt = nowIso();
  const view = toHoursView(row);
  publish<HoursReviewedData>(EVENTS.HOURS_REVIEWED, {
    hoursId: row.id,
    donorId: row.donorId,
    hours: row.hours,
    status: dto.status,
    institutionName: view.institution.name,
  });
  recordAudit(SERVICE, {
    actor,
    action: dto.status === 'APPROVED' ? 'hours.approved' : 'hours.rejected',
    entity: 'complementary_hours',
    entityId: row.id,
    metadata: { donorId: row.donorId, hours: row.hours, institutionId: row.institutionId },
  });
  return { ...view, donor: donorNames([row.donorId]).get(row.donorId)! };
}

function adminInstitutions(): InstitutionView[] {
  return [...state().institutions].sort(byName).map(toInstitutionView);
}

interface InstitutionBody {
  name?: string;
  hoursPerDonation?: number;
  active?: boolean;
}

function institutionSpec(partial: boolean) {
  return {
    name: { optional: partial, transform: trim, rules: [isString, minLength(3), maxLength(120)] },
    hoursPerDonation: {
      optional: partial,
      transform: toNumber,
      rules: [isInt, min(1), max(40)],
    },
    active: { optional: true, transform: toBoolean, rules: [isBoolean] },
  };
}

/** Nome único (índice único no banco): 409 com o erro no campo. */
function assertNameFree(name: string | undefined, exceptId?: string): void {
  if (name === undefined) return;
  if (state().institutions.some((row) => row.name === name && row.id !== exceptId)) {
    fail(409, 'INSTITUTION_NAME_TAKEN', 'Já existe uma instituição com este nome.', undefined, [
      { field: 'name', message: 'Já existe uma instituição com este nome.' },
    ]);
  }
}

function auditInstitution(request: AuthedRequest, action: string, saved: EngagementInstitution) {
  recordAudit(SERVICE, {
    actor: request.user,
    action,
    entity: 'partner_institution',
    entityId: saved.id,
    metadata: { hoursPerDonation: saved.hoursPerDonation, active: saved.active },
  });
}

function createInstitution(request: AuthedRequest): InstitutionView {
  const dto = validate<
    Required<Pick<InstitutionBody, 'name' | 'hoursPerDonation'>> & InstitutionBody
  >(bodyObject(request.body), institutionSpec(false));
  assertNameFree(dto.name);
  const now = nowIso();
  const saved: EngagementInstitution = {
    id: uuid(),
    name: dto.name,
    hoursPerDonation: dto.hoursPerDonation,
    active: dto.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  state().institutions.push(saved);
  auditInstitution(request, 'institution.created', saved);
  return toInstitutionView(saved);
}

/** Mudar as horas por doação vale só para os próximos pedidos. */
function updateInstitution(request: AuthedRequest): InstitutionView {
  const id = parseUuid(request.params.id);
  const dto = validate<InstitutionBody>(bodyObject(request.body), institutionSpec(true));
  const row = state().institutions.find((item) => item.id === id);
  if (!row) fail(404, 'INSTITUTION_NOT_FOUND', 'Instituição não encontrada.');
  assertNameFree(dto.name, id);
  if (dto.name !== undefined) row.name = dto.name;
  if (dto.hoursPerDonation !== undefined) row.hoursPerDonation = dto.hoursPerDonation;
  if (dto.active !== undefined && dto.active !== null) row.active = dto.active;
  row.updatedAt = nowIso();
  auditInstitution(request, 'institution.updated', row);
  return toInstitutionView(row);
}

function achievementView(code: AchievementCode): AdminAchievementView {
  const engagement = state();
  const row = engagement.achievements.find((item) => item.code === code)!;
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    criteria: row.criteria,
    threshold: row.threshold,
    active: row.active,
    unlockedCount: engagement.donorAchievements.filter((item) => item.achievementCode === code)
      .length,
  };
}

function adminAchievements(): AdminAchievementView[] {
  return [...state().achievements]
    .sort((a, b) => a.order - b.order)
    .map((row) => achievementView(row.code));
}

function updateAchievement(request: AuthedRequest): AdminAchievementView {
  const code = request.params.code;
  const dto = validate<{ name?: string; description?: string; active?: boolean }>(
    bodyObject(request.body),
    {
      name: { optional: true, transform: trim, rules: [isString, minLength(3), maxLength(60)] },
      description: {
        optional: true,
        transform: trim,
        rules: [isString, minLength(3), maxLength(200)],
      },
      active: { optional: true, transform: toBoolean, rules: [isBoolean] },
    },
  );
  const row = state().achievements.find((item) => item.code === code);
  if (!ACHIEVEMENT_CODES.includes(code as AchievementCode) || !row) {
    fail(404, 'ACHIEVEMENT_NOT_FOUND', 'Conquista não encontrada.');
  }
  if (dto.name !== undefined && dto.name !== null) row.name = dto.name;
  if (dto.description !== undefined && dto.description !== null) row.description = dto.description;
  if (dto.active !== undefined && dto.active !== null) row.active = dto.active;
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'achievement.updated',
    entity: 'achievement',
    entityId: code,
    metadata: {
      fields: Object.keys(dto),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    },
  });
  return achievementView(row.code);
}

/** Mudanças valem só para os próximos eventos; pontos já lançados não são recalculados. */
function updateSettings(request: AuthedRequest): GamificationSettingsView {
  const dto = validate<Partial<GamificationSettingsView>>(bodyObject(request.body), {
    pointsBasis: { optional: true, rules: [isIn(POINTS_BASES)] },
    firstPoints: { optional: true, transform: toNumber, rules: [isInt, min(0), max(1000)] },
    recurringPoints: { optional: true, transform: toNumber, rules: [isInt, min(0), max(1000)] },
    campaignPoints: { optional: true, transform: toNumber, rules: [isInt, min(0), max(1000)] },
    rankingEnabled: { optional: true, transform: toBoolean, rules: [isBoolean] },
  });
  const settings = state().settings;
  for (const [key, value] of Object.entries(dto)) {
    if (value !== undefined && value !== null) Object.assign(settings, { [key]: value });
  }
  recordAudit(SERVICE, {
    actor: request.user,
    action: 'gamification.settings_updated',
    entity: 'engagement_settings',
    entityId: '1',
    metadata: { ...dto },
  });
  return settingsView();
}

// --- Estatísticas (GET /internal/stats) -------------------------------------------

/**
 * Indicadores do período (pontos e conquistas por data do lançamento) e totais
 * atuais (horas, participantes do ranking, níveis). Sem recorte por unidade ou tipo.
 */
function stats(filters: StatsFilters): EngagementStats {
  const range = statsRange(filters);
  const engagement = state();
  const hoursBy = (status: HoursStatus) =>
    engagement.hours
      .filter((row) => row.status === status)
      .reduce((sum, row) => sum + row.hours, 0);
  const levelCounts = new Map<string, number>(LEVELS.map((level) => [level.code, 0]));
  for (const donor of engagement.donors) {
    const code = levelFor(donor.totalPoints).code;
    levelCounts.set(code, (levelCounts.get(code) ?? 0) + 1);
  }
  return {
    pointsAwarded: engagement.points
      .filter((entry) => inRange(entry.createdAt, range))
      .reduce((sum, entry) => sum + entry.points, 0),
    achievementsUnlocked: engagement.donorAchievements.filter((row) =>
      inRange(row.unlockedAt, range),
    ).length,
    hoursPending: hoursBy('PENDING'),
    hoursApproved: hoursBy('APPROVED'),
    rankingParticipants: engagement.donors.filter((row) => row.rankingOptIn).length,
    levels: LEVELS.map((level) => ({
      code: level.code,
      name: level.name,
      count: levelCounts.get(level.code) ?? 0,
    })),
  };
}

// --- Consumidores de eventos --------------------------------------------------------

/** Data do fato (occurredAt do payload), com o envelope como reserva. */
function occurredAt(meta: EventMeta, value: string): string {
  const time = Date.parse(value);
  return Number.isNaN(time) ? meta.occurredAt : new Date(time).toISOString();
}

/** Pontos e conquistas resultantes viram eventos (o notification transforma em avisos). */
function publishProgress(donorId: string, result: ProgressResult): void {
  if (result.pointsAwarded > 0) {
    publish<PointsAwardedData>(EVENTS.POINTS_AWARDED, {
      donorId,
      points: result.pointsAwarded,
      reason: describeAwards(result.awards),
      totalPoints: result.totalPoints,
    });
  }
  for (const achievement of result.unlocked) {
    publish<AchievementUnlockedData>(EVENTS.ACHIEVEMENT_UNLOCKED, {
      donorId,
      achievementCode: achievement.code,
      achievementName: achievement.name,
    });
  }
}

function registerConsumers(): void {
  subscribe<AttendanceCompletedData>(
    EVENTS.ATTENDANCE_COMPLETED,
    'attendance-points',
    (data, meta) => {
      const engagement = state();
      // Conta excluída antes de o evento chegar: nada de pontos novos para ela.
      if (engagement.deletedUsers.includes(data.donorId)) return;
      const result = recordAttendance(engagement, {
        donorId: data.donorId,
        campaignId: data.campaignId,
        occurredAt: occurredAt(meta, data.occurredAt),
        sourceEventId: meta.id,
      });
      publishProgress(data.donorId, result);
    },
  );

  subscribe<DonationCompletedData>(EVENTS.DONATION_COMPLETED, 'donation-progress', (data, meta) => {
    const engagement = state();
    if (engagement.deletedUsers.includes(data.donorId)) return;
    const result = recordDonation(engagement, {
      donorId: data.donorId,
      donationId: data.donationId,
      campaignId: data.campaignId,
      occurredAt: occurredAt(meta, data.occurredAt),
      sourceEventId: meta.id,
    });
    publishProgress(data.donorId, result);
  });

  /**
   * Conta excluída (LGPD) → o doador sai do ranking (apelido apagado), perde o
   * vínculo com a instituição e os pedidos de horas pendentes são descartados.
   * Pontos e conquistas já ganhos ficam, ligados só ao id.
   */
  subscribe<UserDeletedData>(EVENTS.USER_DELETED, 'erase-public-profile', (data) => {
    const engagement = state();
    if (!engagement.deletedUsers.includes(data.userId)) engagement.deletedUsers.push(data.userId);
    engagement.hours = engagement.hours.filter(
      (row) => !(row.donorId === data.userId && row.status === 'PENDING'),
    );
    const donor = engagement.donors.find((row) => row.donorId === data.userId);
    if (donor) {
      donor.rankingOptIn = false;
      donor.nickname = null;
      donor.institutionId = null;
      donor.updatedAt = nowIso();
    }
  });
}

export function registerEngagement(): void {
  const donorOnly = { permissions: ['self:gamification' as const] };
  route('GET', '/gamification/profile', (request) => profile(request.user.id), donorOnly);
  route('GET', '/gamification/ranking', (request) => ranking(request.user.id), donorOnly);
  route('PUT', '/gamification/ranking/opt-in', setRankingOptIn, donorOnly);

  route('GET', '/institutions', () => activeInstitutions(), { auth: 'public' });
  route('GET', '/complementary-hours/me', (request) => myHours(request.user.id), donorOnly);
  route('PUT', '/complementary-hours/institution', setInstitution, donorOnly);

  const hoursReview = { permissions: ['hours:review' as const] };
  route('GET', '/admin/complementary-hours', listHours, hoursReview);
  route('PATCH', '/admin/complementary-hours/:id', reviewHours, hoursReview);
  route('GET', '/admin/institutions', () => adminInstitutions(), hoursReview);
  route('POST', '/admin/institutions', createInstitution, hoursReview);
  route('PATCH', '/admin/institutions/:id', updateInstitution, hoursReview);

  const manage = { permissions: ['gamification:manage' as const] };
  route('GET', '/admin/achievements', () => adminAchievements(), manage);
  route('PATCH', '/admin/achievements/:code', updateAchievement, manage);
  route('GET', '/admin/gamification/settings', () => settingsView(), manage);
  route('PATCH', '/admin/gamification/settings', updateSettings, manage);

  registerConsumers();
  internal.engagement.stats = stats;
}

/**
 * Módulo notification da demonstração (espelho do notification-service):
 * central de notificações in-app, alimentada pelos eventos de domínio dos
 * outros serviços (mesmos títulos e textos do back-end).
 */
import {
  EVENTS,
  stockStatusFor,
  type AppointmentReminderDueData,
  type EventPayloads,
  type EventType,
  type NotificationType,
  type NotificationView,
  type Paginated,
  type StockLevelChangedData,
  type UnreadCountResponse,
  type UserDeletedData,
} from '@pulso/contracts';
import { SEED_IDS } from '@backend/libs/common/src/seed/dataset';
import { subscribe, type EventMeta } from '../../core/events';
import { fail, route, type AuthedRequest, type FieldIssue } from '../../core/http';
import { internal } from '../../core/internal';
import { db, type SeedContext } from '../../core/state';
import { nowIso, paginate, uuid } from '../../core/support';
import * as messages from './messages';
import type { NotificationDraft } from './messages';

export interface DemoNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  /** Evento de origem (chave única com userId e type, como no banco). */
  sourceEventId: string | null;
  createdAt: string;
}

export interface NotificationState {
  notifications: DemoNotification[];
  /** Contas excluídas (identity.user.deleted): eventos atrasados não geram avisos. */
  deletedUsers: string[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Mesmo seed do back-end (buildSeedRows): notificações fictícias da doadora de
 * demonstração e alertas de estoque crítico para a administradora, com os
 * textos gerados pelos eventos reais.
 *
 * A limpeza diária (lidas há mais de 180 dias) não roda: no back-end ela só
 * dispara 24 h depois de o serviço subir, e a demonstração recomeça todo dia.
 */
export function seedNotification({ dataset }: SeedContext): NotificationState {
  const now = new Date();
  const rows: DemoNotification[] = [];
  const add = (item: NotificationDraft | null, createdAt: Date, read: boolean) => {
    if (!item) return;
    rows.push({
      id: uuid(),
      ...item,
      sourceEventId: null,
      createdAt: createdAt.toISOString(),
      readAt: read ? new Date(createdAt.getTime() + HOUR).toISOString() : null,
    });
  };

  const donor = dataset.users.find((user) => user.id === SEED_IDS.users.donor);
  if (donor) {
    add(
      messages.welcome({ userId: donor.id, name: donor.name, role: 'DONOR' }),
      new Date(donor.createdAt),
      true,
    );
  }
  const attendance = dataset.attendances.find(
    (item) => item.donorId === SEED_IDS.users.donor && item.donation?.status === 'COMPLETED',
  );
  if (attendance?.donation) {
    const donatedAt = new Date(attendance.donation.occurredAt);
    add(
      messages.donationCompleted({
        donationId: attendance.donation.id,
        code: attendance.donation.code,
        donorId: attendance.donorId,
        unitId: attendance.unitId,
        attendanceId: attendance.id,
        campaignId: attendance.campaignId,
        occurredAt: attendance.donation.occurredAt,
      }),
      donatedAt,
      true,
    );
    add(
      messages.achievementUnlocked({
        donorId: attendance.donorId,
        achievementCode: 'FIRST_DONATION',
        achievementName: 'Primeira Doação',
      }),
      new Date(donatedAt.getTime() + 60_000),
      true,
    );
    add(
      messages.pointsAwarded({
        donorId: attendance.donorId,
        points: 100,
        reason: 'FIRST',
        totalPoints: 100,
      }),
      new Date(donatedAt.getTime() + 2 * 60_000),
      false,
    );
    const institutionId = dataset.donorInstitutions[attendance.donorId];
    const institution = dataset.institutions.find((item) => item.id === institutionId);
    if (institution) {
      add(
        messages.hoursReviewed({
          hoursId: attendance.donation.id,
          donorId: attendance.donorId,
          hours: institution.hoursPerDonation,
          status: 'APPROVED',
          institutionName: institution.name,
        }),
        new Date(donatedAt.getTime() + 5 * DAY),
        false,
      );
    }
  }

  dataset.stock
    .filter((item) => stockStatusFor(item.quantity, item.minimum, item.ideal) === 'CRITICAL')
    .forEach((item, index) => {
      const [alert] = messages.stockAlert(
        {
          bloodType: item.bloodType,
          previousStatus: 'ATTENTION',
          status: 'CRITICAL',
          quantity: item.quantity,
        },
        [SEED_IDS.users.admin],
      );
      add(alert, new Date(now.getTime() - (index + 1) * HOUR), false);
    });

  return { notifications: rows, deletedUsers: [] };
}

const state = () => db().notification;

function toView(row: DemoNotification): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

// --- Validação (ValidationPipe + ParseUUIDPipe do back-end) --------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateListQuery(query: URLSearchParams): void {
  const errors: FieldIssue[] = [];
  for (const key of query.keys()) {
    if (!['page', 'pageSize', 'onlyUnread'].includes(key)) {
      errors.push({ field: key, message: 'Campo não permitido.' });
    }
  }
  const integer = (field: string, maximum?: number) => {
    const raw = query.get(field);
    if (raw === null) return;
    const value = Number(raw);
    // Mesma ordem do class-validator (decoradores de baixo para cima: @Max, @Min, @IsInt).
    if (maximum !== undefined && !(value <= maximum)) {
      errors.push({ field, message: `Deve ser menor ou igual a ${maximum}.` });
    }
    if (!(value >= 1)) errors.push({ field, message: 'Deve ser maior ou igual a 1.' });
    if (!Number.isInteger(value)) errors.push({ field, message: 'Deve ser um número inteiro.' });
  };
  // O campo próprio do DTO vem antes dos herdados (PaginationQueryDto).
  const onlyUnread = query.get('onlyUnread');
  if (onlyUnread !== null && onlyUnread !== 'true' && onlyUnread !== 'false') {
    errors.push({ field: 'onlyUnread', message: 'Valor não permitido.' });
  }
  integer('page');
  integer('pageSize', 100);
  if (errors.length > 0) {
    fail(400, 'VALIDATION_ERROR', 'Alguns campos precisam de correção.', 'Dados inválidos', errors);
  }
}

// --- Rotas -------------------------------------------------------------------

function list(request: AuthedRequest): Paginated<NotificationView> {
  validateListQuery(request.query);
  const onlyUnread = request.query.get('onlyUnread') === 'true';
  const rows = state()
    .notifications.filter(
      (row) => row.userId === request.user.id && (!onlyUnread || row.readAt === null),
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
  return paginate(rows.map(toView), request.query);
}

function unreadCount(request: AuthedRequest): UnreadCountResponse {
  return {
    count: state().notifications.filter(
      (row) => row.userId === request.user.id && row.readAt === null,
    ).length,
  };
}

/** Marca como lida (idempotente). Notificação de outra pessoa → 404. */
function markRead(request: AuthedRequest): NotificationView {
  const id = request.params.id;
  if (!UUID.test(id)) fail(400, 'BAD_REQUEST', 'Verifique os dados informados e tente novamente.');
  const row = state().notifications.find(
    (item) => item.id === id && item.userId === request.user.id,
  );
  if (!row) fail(404, 'NOTIFICATION_NOT_FOUND', 'Notificação não encontrada.');
  if (!row.readAt) row.readAt = nowIso();
  return toView(row);
}

function markAllRead(request: AuthedRequest): { count: number } {
  const now = nowIso();
  let count = 0;
  for (const row of state().notifications) {
    if (row.userId === request.user.id && row.readAt === null) {
      row.readAt = now;
      count++;
    }
  }
  return { count };
}

// --- Consumidores de eventos ----------------------------------------------------

/**
 * Grava os rascunhos ignorando os que já existem para o mesmo evento (chave
 * única sourceEventId + userId + type) e os de contas já excluídas.
 */
function save(sourceEventId: string, drafts: NotificationDraft[]): number {
  const notification = state();
  let count = 0;
  for (const item of drafts) {
    if (notification.deletedUsers.includes(item.userId)) continue;
    const duplicate = notification.notifications.some(
      (row) =>
        row.sourceEventId === sourceEventId && row.userId === item.userId && row.type === item.type,
    );
    if (duplicate) continue;
    notification.notifications.push({
      id: uuid(),
      ...item,
      readAt: null,
      sourceEventId,
      createdAt: nowIso(),
    });
    count++;
  }
  return count;
}

type Builder<T extends EventType> = (
  data: EventPayloads[T],
) => NotificationDraft | NotificationDraft[] | null;

function register<T extends EventType>(type: T, name: string, build: Builder<T>): void {
  subscribe<EventPayloads[T]>(type, name, (data, meta: EventMeta) => {
    const result = build(data);
    if (!result) return;
    save(meta.id, Array.isArray(result) ? result : [result]);
  });
}

/**
 * Lembrete só para quem aceitou "Lembretes e comunicações" (consentimento
 * opcional, revogável a qualquer momento).
 */
function handleReminder(data: AppointmentReminderDueData, meta: EventMeta): void {
  const { granted } = internal.identity.communicationsConsent([data.donorId]);
  if (!granted.includes(data.donorId)) return;
  save(meta.id, [messages.appointmentReminder(data)]);
}

/** Alerta de estoque para cada administrador ativo. */
function handleStock(data: StockLevelChangedData, meta: EventMeta): void {
  if (!messages.shouldAlertStock(data)) return;
  const admins = internal.identity.usersByRole('ADMIN');
  save(
    meta.id,
    messages.stockAlert(
      data,
      admins.map((admin) => admin.id),
    ),
  );
}

function registerConsumers(): void {
  register(EVENTS.USER_REGISTERED, 'notify-welcome', messages.welcome);
  register(EVENTS.APPOINTMENT_BOOKED, 'notify-appointment-booked', messages.appointmentBooked);
  register(
    EVENTS.APPOINTMENT_CANCELLED,
    'notify-appointment-cancelled',
    messages.appointmentCancelled,
  );
  register(
    EVENTS.APPOINTMENT_RESCHEDULED,
    'notify-appointment-rescheduled',
    messages.appointmentRescheduled,
  );
  subscribe<AppointmentReminderDueData>(
    EVENTS.APPOINTMENT_REMINDER_DUE,
    'notify-appointment-reminder',
    handleReminder,
  );
  register(
    EVENTS.ATTENDANCE_COMPLETED,
    'notify-attendance-completed',
    messages.attendanceCompleted,
  );
  register(EVENTS.DONATION_COMPLETED, 'notify-donation-completed', messages.donationCompleted);
  register(EVENTS.DOCUMENT_ISSUED, 'notify-document-issued', messages.documentIssued);
  register(EVENTS.POINTS_AWARDED, 'notify-points-awarded', messages.pointsAwarded);
  register(
    EVENTS.ACHIEVEMENT_UNLOCKED,
    'notify-achievement-unlocked',
    messages.achievementUnlocked,
  );
  register(EVENTS.HOURS_REVIEWED, 'notify-hours-reviewed', messages.hoursReviewed);
  subscribe<StockLevelChangedData>(EVENTS.STOCK_LEVEL_CHANGED, 'notify-stock-alert', handleStock);
  // Conta excluída (LGPD): as notificações da pessoa são apagadas.
  subscribe<UserDeletedData>(EVENTS.USER_DELETED, 'erase-notifications', (data) => {
    const notification = state();
    if (!notification.deletedUsers.includes(data.userId)) {
      notification.deletedUsers.push(data.userId);
    }
    notification.notifications = notification.notifications.filter(
      (row) => row.userId !== data.userId,
    );
  });
}

export function registerNotification(): void {
  route('GET', '/notifications', list);
  route('GET', '/notifications/unread-count', unreadCount);
  route('PATCH', '/notifications/read-all', markAllRead);
  route('PATCH', '/notifications/:id/read', markRead);

  registerConsumers();
}

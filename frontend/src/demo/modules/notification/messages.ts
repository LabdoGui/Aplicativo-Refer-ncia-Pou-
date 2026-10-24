/**
 * Textos das notificações, gerados a partir dos eventos de domínio.
 * Cópia fiel de backend/services/notification/src/notifications/notification-messages.ts
 * (o original importa @pulso/common, que traz o Nest; aqui as datas vêm do core).
 *
 * Funções puras (testadas sem banco): recebem os dados do evento e devolvem o
 * rascunho da notificação, ou `null` quando o evento não gera aviso.
 * RN19: nenhum texto menciona resultado de triagem, dado clínico ou motivo.
 */
import { addDays, todayLocal, toLocalDate } from '../../core/support';
import {
  BLOOD_TYPE_LABELS,
  STOCK_STATUS_LABELS,
  type AchievementUnlockedData,
  type AppointmentBookedData,
  type AppointmentCancelledData,
  type AppointmentReminderDueData,
  type AppointmentRescheduledData,
  type AttendanceCompletedData,
  type DocumentIssuedData,
  type DonationCompletedData,
  type HoursReviewedData,
  type NotificationType,
  type PointsAwardedData,
  type StockLevelChangedData,
  type StockStatus,
  type UserRegisteredData,
} from '@pulso/contracts';
import {
  bags,
  firstName,
  formatDateTime,
  formatTime,
  truncate,
} from '@backend/services/notification/src/notifications/format';

export const TITLE_MAX = 60;
export const BODY_MAX = 200;

export interface NotificationDraft {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
}

function draft(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link: string | null,
): NotificationDraft {
  return {
    userId,
    type,
    title: truncate(title, TITLE_MAX),
    body: truncate(body, BODY_MAX),
    link,
  };
}

export function welcome(data: UserRegisteredData): NotificationDraft | null {
  if (data.role !== 'DONOR') return null;
  const name = firstName(data.name);
  return draft(
    data.userId,
    'WELCOME',
    'Boas-vindas ao SangueConecta',
    `${name ? `Olá, ${name}! ` : ''}Faça a pré-triagem informativa e agende sua doação quando quiser.`,
    '/app',
  );
}

export function appointmentBooked(data: AppointmentBookedData): NotificationDraft {
  return draft(
    data.donorId,
    'APPOINTMENT_CONFIRMED',
    'Agendamento confirmado',
    `${formatDateTime(data.startsAt)} em ${data.unitName}. Código ${data.code}.`,
    `/app/agendamentos/${data.appointmentId}`,
  );
}

export function appointmentCancelled(data: AppointmentCancelledData): NotificationDraft {
  const when = `${formatDateTime(data.startsAt)} em ${data.unitName}`;
  if (data.cancelledBy === 'DONOR') {
    return draft(
      data.donorId,
      'APPOINTMENT_CANCELLED',
      'Cancelamento confirmado',
      `Seu agendamento de ${when} foi cancelado. Quando quiser, é só agendar de novo.`,
      '/app/agendar',
    );
  }
  return draft(
    data.donorId,
    'APPOINTMENT_CANCELLED',
    'Seu agendamento foi cancelado pela unidade',
    `O horário de ${when} não está mais disponível. Escolha um novo horário quando puder.`,
    '/app/agendar',
  );
}

export function appointmentRescheduled(data: AppointmentRescheduledData): NotificationDraft {
  return draft(
    data.donorId,
    'APPOINTMENT_RESCHEDULED',
    'Agendamento remarcado',
    `Novo horário: ${formatDateTime(data.startsAt)} em ${data.unitName}.`,
    `/app/agendamentos/${data.appointmentId}`,
  );
}

/** Lembrete com dicas práticas (não são critérios clínicos). `today` permite testar. */
export function appointmentReminder(
  data: AppointmentReminderDueData,
  today: string = todayLocal(),
): NotificationDraft {
  const day = toLocalDate(data.startsAt);
  const tips = 'Leve um documento oficial com foto. Se não puder ir, cancele ou remarque pelo app.';
  let title = 'Lembrete: sua doação está chegando';
  let when = formatDateTime(data.startsAt);
  if (day === today) {
    title = 'Lembrete: sua doação é hoje';
    when = `Hoje às ${formatTime(data.startsAt)}`;
  } else if (day === addDays(today, 1)) {
    title = 'Lembrete: sua doação é amanhã';
    when = `Amanhã às ${formatTime(data.startsAt)}`;
  }
  return draft(
    data.donorId,
    'APPOINTMENT_REMINDER',
    title,
    `${when} em ${data.unitName}. ${tips}`,
    `/app/agendamentos/${data.appointmentId}`,
  );
}

/** Atendimento sem doação: só agradece (sem resultado nem motivo, RN19). */
export function attendanceCompleted(data: AttendanceCompletedData): NotificationDraft | null {
  if (data.donationCompleted) return null;
  return draft(
    data.donorId,
    'ATTENDANCE_COMPLETED',
    'Obrigado por comparecer',
    'Seu atendimento foi registrado. Veja os detalhes no seu histórico de doações.',
    `/app/doacoes/${data.attendanceId}`,
  );
}

export function donationCompleted(data: DonationCompletedData): NotificationDraft {
  return draft(
    data.donorId,
    'DONATION_COMPLETED',
    'Doação registrada. Obrigado!',
    'Seu gesto ajuda a salvar vidas. Veja seus pontos, suas conquistas e gere sua declaração.',
    `/app/doacoes/${data.attendanceId}/obrigado`,
  );
}

export function documentIssued(data: DocumentIssuedData): NotificationDraft {
  return draft(
    data.donorId,
    'DOCUMENT_ISSUED',
    'Documento pronto',
    `${data.title} disponível para visualizar e baixar.`,
    '/app/documentos',
  );
}

export function pointsAwarded(data: PointsAwardedData): NotificationDraft | null {
  if (data.points <= 0) return null;
  return draft(
    data.donorId,
    'POINTS_AWARDED',
    `+${data.points} pontos`,
    `Você agora tem ${data.totalPoints} pontos. Veja seu nível e suas próximas conquistas.`,
    '/app/conquistas',
  );
}

export function achievementUnlocked(data: AchievementUnlockedData): NotificationDraft {
  return draft(
    data.donorId,
    'ACHIEVEMENT_UNLOCKED',
    `Nova conquista: ${data.achievementName}`,
    'Parabéns! Veja suas conquistas e o próximo objetivo.',
    '/app/conquistas',
  );
}

export function hoursReviewed(data: HoursReviewedData): NotificationDraft {
  const hours = `${data.hours} h`;
  if (data.status === 'APPROVED') {
    return draft(
      data.donorId,
      'HOURS_REVIEWED',
      'Horas complementares aprovadas',
      `${data.institutionName} aprovou ${hours} de atividades complementares pela sua doação.`,
      '/app/horas',
    );
  }
  return draft(
    data.donorId,
    'HOURS_REVIEWED',
    'Atualização das horas complementares',
    `${data.institutionName} não aprovou o pedido de ${hours}. Em caso de dúvida, fale com a sua instituição.`,
    '/app/horas',
  );
}

const SEVERITY: Record<StockStatus, number> = { NORMAL: 0, ATTENTION: 1, CRITICAL: 2 };

/** Avisa quando o nível piora (atenção ou crítico) ou volta ao adequado. */
export function shouldAlertStock(data: StockLevelChangedData): boolean {
  if (SEVERITY[data.status] > SEVERITY[data.previousStatus]) return true;
  return data.status === 'NORMAL' && data.previousStatus !== 'NORMAL';
}

export function stockAlert(data: StockLevelChangedData, adminIds: string[]): NotificationDraft[] {
  if (!shouldAlertStock(data)) return [];
  const type = BLOOD_TYPE_LABELS[data.bloodType];
  const status = STOCK_STATUS_LABELS[data.status];
  // RN11: crítico = abaixo do mínimo; atenção = abaixo do ideal.
  const level = data.status === 'CRITICAL' ? 'do mínimo' : 'do ideal';
  const [title, body] =
    data.status === 'NORMAL'
      ? [
          `Estoque ${status.toLowerCase()}: ${type}`,
          `O estoque de ${type} voltou ao nível ideal (${bags(data.quantity)}).`,
        ]
      : [
          `Estoque ${status.toLowerCase()}: ${type}`,
          `O estoque de ${type} está abaixo ${level} (${bags(data.quantity)}). Avalie campanhas e movimentações.`,
        ];
  return adminIds.map((adminId) => draft(adminId, 'STOCK_ALERT', title, body, '/admin/estoque'));
}

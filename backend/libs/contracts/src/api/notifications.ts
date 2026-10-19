import type { NotificationType } from '../domain';

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Rota do app para onde a notificação leva (ex.: /app/agendamentos/:id). */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

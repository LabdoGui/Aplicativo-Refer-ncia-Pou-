/** Módulo notification da demonstração (espelho do notification-service). */
import type { SeedContext } from '../../core/state';

export interface NotificationState {
  // Preenchido pelo módulo.
  placeholder?: never;
}

export function seedNotification(_ctx: SeedContext): NotificationState {
  return {};
}

export function registerNotification(): void {
  // Rotas, assinaturas de eventos e funções internas.
}

/** Módulo scheduling da demonstração (espelho do scheduling-service). */
import type { SeedContext } from '../../core/state';

export interface SchedulingState {
  // Preenchido pelo módulo.
  placeholder?: never;
}

export function seedScheduling(_ctx: SeedContext): SchedulingState {
  return {};
}

export function registerScheduling(): void {
  // Rotas, assinaturas de eventos e funções internas.
}

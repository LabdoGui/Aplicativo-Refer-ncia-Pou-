/** Módulo engagement da demonstração (espelho do engagement-service). */
import type { SeedContext } from '../../core/state';

export interface EngagementState {
  // Preenchido pelo módulo.
  placeholder?: never;
}

export function seedEngagement(_ctx: SeedContext): EngagementState {
  return {};
}

export function registerEngagement(): void {
  // Rotas, assinaturas de eventos e funções internas.
}

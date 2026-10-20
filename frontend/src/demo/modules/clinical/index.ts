/** Módulo clinical da demonstração (espelho do clinical-service). */
import type { SeedContext } from '../../core/state';

export interface ClinicalState {
  // Preenchido pelo módulo.
  placeholder?: never;
}

export function seedClinical(_ctx: SeedContext): ClinicalState {
  return {};
}

export function registerClinical(): void {
  // Rotas, assinaturas de eventos e funções internas.
}

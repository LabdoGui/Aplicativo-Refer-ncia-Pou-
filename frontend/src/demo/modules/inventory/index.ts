/** Módulo inventory da demonstração (espelho do inventory-service). */
import type { SeedContext } from '../../core/state';

export interface InventoryState {
  // Preenchido pelo módulo.
  placeholder?: never;
}

export function seedInventory(_ctx: SeedContext): InventoryState {
  return {};
}

export function registerInventory(): void {
  // Rotas, assinaturas de eventos e funções internas.
}

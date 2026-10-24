/**
 * Estado da demonstração: o "banco" de cada serviço, em memória e guardado no
 * próprio aparelho (localStorage) quando possível. Tudo é JSON (datas em ISO).
 */
import type { AuditLogEntry } from '@pulso/contracts';
import type { SeedDataset } from '@backend/libs/common/src/seed/dataset';
import type { ClinicalState } from '../modules/clinical';
import type { EngagementState } from '../modules/engagement';
import type { IdentityState } from '../modules/identity';
import type { InventoryState } from '../modules/inventory';
import type { NotificationState } from '../modules/notification';
import type { SchedulingState } from '../modules/scheduling';

/** Muda quando o formato do estado muda: dados guardados de outra versão são descartados. */
export const STATE_VERSION = 1;

export interface SeedContext {
  dataset: SeedDataset;
  /** Dia do seed (AAAA-MM-DD, America/Sao_Paulo). */
  today: string;
}

export interface DemoState {
  version: number;
  seededOn: string;
  identity: IdentityState;
  scheduling: SchedulingState;
  clinical: ClinicalState;
  inventory: InventoryState;
  engagement: EngagementState;
  notification: NotificationState;
  audit: AuditLogEntry[];
}

let current: DemoState | null = null;

export function db(): DemoState {
  if (!current) throw new Error('[demo] estado não inicializado');
  return current;
}

export function setState(state: DemoState): void {
  current = state;
}

const STORAGE_KEY = 'pulso-demo-state';

/** Lê o estado guardado no aparelho (só se for da mesma versão e do mesmo dia). */
export function loadSaved(today: string): DemoState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as DemoState;
    return saved.version === STATE_VERSION && saved.seededOn === today ? saved : null;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Guarda o estado no aparelho agora (falhas são ignoradas). */
export function saveNow(): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    if (current) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Sem armazenamento (modo privado, cota cheia): a demo segue só em memória.
  }
}

/** Guarda o estado no aparelho logo depois (sem travar a interface). */
export function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

/** Salva o que estiver pendente ao fechar ou recarregar a página. */
export function flushPendingSave(): void {
  if (saveTimer !== undefined) saveNow();
}

/** Descarta o estado (memória e aparelho): nada mais é salvo até recarregar. */
export function discardState(): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  current = null;
  clearSaved();
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorado
  }
}

/**
 * Ponte entre o motor (puro) e o React: laço de tempo, salvamento automático,
 * notificações, bloqueio de múltiplas abas e progresso offline.
 */
import { dispatch as engineDispatch, type Action, type ActionResult } from '../engine/actions';
import { advance, applyOffline, newGame, type OfflineReport } from '../engine/simulation';
import type { GameState, Notice } from '../engine/types';
import { SaveManager } from '../save/saveManager';
import { deserializeState, serializeState } from '../save/serialize';
import { createBrowserStorage } from '../save/storage';
import { playSound } from './sound';

export interface Toast extends Notice {
  id: number;
  expiresAt: number;
}

const TICK_MS = 250;
const AUTOSAVE_MS = 10_000;
const EMERGENCY_KEY = 'tycoon-empire:emergency';
const MAX_TOASTS = 3;

let toastSeq = 0;
let actionSeq = 0;

export class GameStore {
  version = 0;
  toasts: Toast[] = [];
  offlineReport: OfflineReport | null = null;
  loadWarnings: string[] = [];
  saveStatus: { at: number; error: string | null } = { at: 0, error: null };
  private listeners = new Set<() => void>();
  private lastTick = performance.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSave = 0;

  private constructor(public state: GameState, readonly saves: SaveManager) {}

  static async boot(): Promise<GameStore> {
    const storage = await createBrowserStorage();
    const mgr = new SaveManager(storage);
    const loaded = await mgr.load();
    let state = loaded.state;
    const warnings = [...loaded.warnings];

    // Cópia de emergência gravada de forma síncrona ao fechar a página (mais nova que a do IndexedDB?).
    try {
      const em = localStorage.getItem(EMERGENCY_KEY);
      if (em) {
        const parsed = deserializeState(em);
        if (!state || parsed.savedAt > (loaded.savedAt ?? 0)) {
          state = parsed.state;
          if (!loaded.state) warnings.push('Progresso recuperado da cópia de emergência.');
        }
      }
    } catch {
      /* cópia de emergência ilegível: ignorada (a principal continua valendo) */
    }
    if (storage.kind === 'memória') warnings.push('Este navegador não permite salvar dados: o progresso será perdido ao fechar.');

    const store = new GameStore(state ?? newGame(), mgr);
    store.loadWarnings = warnings;
    if (state) {
      const report = applyOffline(store.state, Date.now());
      if (report && (report.creditedMs > 0 || report.clockWentBack)) store.offlineReport = report;
    }
    store.drainNotices();
    await store.save();
    return store;
  }

  start(): void {
    if (this.timer) return;
    this.lastTick = performance.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      this.emergencySave();
      void this.save();
    } else {
      this.tick();
    }
  };

  private onPageHide = () => this.emergencySave();

  private tick(): void {
    const now = performance.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (dt > 30_000) {
      // Aba congelada/computador suspenso: trata como período offline (mesmas regras, com limite).
      const report = applyOffline(this.state, Date.now());
      if (report && report.creditedMs > 60_000) this.offlineReport = report;
    } else if (dt > 0) {
      this.state.lastRealTime += dt;
      advance(this.state, dt);
    }
    const t = Date.now();
    this.toasts = this.toasts.filter((x) => x.expiresAt > t);
    this.drainNotices();
    if (t - this.lastSave > AUTOSAVE_MS) void this.save();
    this.emit();
  }

  async save(): Promise<void> {
    this.lastSave = Date.now();
    try {
      await this.saves.save(this.state);
      this.saveStatus = { at: Date.now(), error: null };
    } catch (e) {
      this.saveStatus = { at: this.saveStatus.at, error: (e as Error).message };
    }
    this.emit();
  }

  private emergencySave(): void {
    try {
      localStorage.setItem(EMERGENCY_KEY, serializeState(this.state));
    } catch {
      /* sem espaço/privado: o salvamento principal continua */
    }
  }

  dispatch(action: Action): ActionResult {
    const res = engineDispatch(this.state, action, `ui-${Date.now()}-${++actionSeq}`);
    if (!res.ok && !res.duplicate) {
      this.pushToast({ kind: 'error', title: res.error });
      playSound(this.state.settings, 'error');
    } else if (res.ok && action.type !== 'click' && action.type !== 'updateSettings') {
      playSound(this.state.settings, 'buy');
      // Compras importantes são salvas imediatamente (não esperam o autosave).
      void this.save();
    }
    this.drainNotices();
    this.emit();
    return res;
  }

  /** Substitui a partida (importação ou novo jogo) — o save anterior é preservado antes. */
  async replaceState(next: GameState): Promise<void> {
    await this.saves.snapshot('pre-replace');
    this.state = next;
    this.offlineReport = null;
    await this.save();
    this.emit();
  }

  private drainNotices(): void {
    for (const n of this.state.notices.splice(0)) {
      if (n.kind === 'achievement') playSound(this.state.settings, 'achievement');
      this.pushToast(n);
    }
  }

  pushToast(n: Notice): void {
    const ttl = n.kind === 'achievement' ? 5000 : n.kind === 'error' ? 3000 : 4000;
    this.toasts.push({ ...n, id: ++toastSeq, expiresAt: Date.now() + ttl });
    if (this.toasts.length > MAX_TOASTS) this.toasts.splice(0, this.toasts.length - MAX_TOASTS);
    this.emit();
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  dismissOffline(): void {
    this.offlineReport = null;
    this.emit();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = () => this.version;

  emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }
}

/**
 * Garante que só uma aba execute o jogo (evita duas abas salvando por cima uma da outra
 * e duplicando renda offline). Retorna false se outra aba já está com o jogo aberto.
 */
export function acquireSingleTabLock(): Promise<boolean> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    locks
      .request('tycoon-empire-game', { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        return new Promise<void>(() => undefined); // mantém o bloqueio enquanto a aba existir
      })
      .catch(() => resolve(true));
  });
}

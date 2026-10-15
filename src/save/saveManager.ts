/**
 * Gerente de salvamento.
 * Garantias:
 * - Nunca grava estado inválido (serializeState valida antes).
 * - Antes de sobrescrever o principal, mantém um backup rotativo (a cada BACKUP_EVERY_MS).
 * - Salvamento principal ilegível → é preservado em "corrupt" e o backup é usado.
 * - Antes de migrar versão, guarda o original em "pre-migration".
 * - Gravação é verificada lendo de volta.
 */
import type { GameState } from '../engine/types';
import { SaveError, deserializeState, serializeState } from './serialize';
import type { SaveStorage } from './storage';

export const KEYS = {
  main: 'main',
  backup: 'backup',
  corrupt: 'corrupt',
  preMigration: 'pre-migration',
  preImport: 'pre-import',
} as const;

const BACKUP_EVERY_MS = 5 * 60_000;

export type LoadSource = 'main' | 'backup' | 'none';

export interface LoadResult {
  state: GameState | null;
  source: LoadSource;
  warnings: string[];
  savedAt?: number;
}

export class SaveManager {
  private lastBackupAt = 0;
  private writing: Promise<void> = Promise.resolve();

  constructor(readonly storage: SaveStorage, private now: () => number = Date.now) {}

  /** Gravações são serializadas: duas chamadas simultâneas nunca se intercalam. */
  save(state: GameState): Promise<void> {
    // Serializa de forma síncrona (captura o estado DESTE momento).
    const text = serializeState(state, this.now());
    const run = async () => {
      const t = this.now();
      if (t - this.lastBackupAt >= BACKUP_EVERY_MS) {
        const current = await this.storage.get(KEYS.main);
        if (current && this.isValid(current)) {
          await this.storage.set(KEYS.backup, current);
          this.lastBackupAt = t;
        } else if (!current) {
          this.lastBackupAt = t;
        }
      }
      await this.storage.set(KEYS.main, text);
      const check = await this.storage.get(KEYS.main);
      if (check !== text) throw new SaveError('Falha ao verificar a gravação.');
    };
    const p = this.writing.then(run, run);
    this.writing = p.catch(() => undefined);
    return p;
  }

  /** Força uma cópia de segurança do salvamento atual (ex.: antes de reiniciar com Legado). */
  async snapshot(key: string): Promise<void> {
    await this.writing;
    const current = await this.storage.get(KEYS.main);
    if (current && this.isValid(current)) await this.storage.set(key, current);
  }

  private isValid(text: string): boolean {
    try {
      deserializeState(text);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<LoadResult> {
    const warnings: string[] = [];
    const main = await this.storage.get(KEYS.main);
    if (main) {
      try {
        const parsed = deserializeState(main);
        if (parsed.migratedFrom !== null) {
          await this.storage.set(KEYS.preMigration, main);
          warnings.push(`Salvamento atualizado da versão ${parsed.migratedFrom} (cópia original preservada).`);
        }
        return { state: parsed.state, source: 'main', warnings, savedAt: parsed.savedAt };
      } catch (e) {
        await this.storage.set(KEYS.corrupt, main);
        warnings.push(`Salvamento principal com problema: ${(e as Error).message} Uma cópia foi preservada.`);
      }
    }
    const backup = await this.storage.get(KEYS.backup);
    if (backup) {
      try {
        const parsed = deserializeState(backup);
        warnings.push('Progresso recuperado do backup automático.');
        return { state: parsed.state, source: 'backup', warnings, savedAt: parsed.savedAt };
      } catch (e) {
        warnings.push(`Backup também inválido: ${(e as Error).message}`);
      }
    }
    return { state: null, source: 'none', warnings };
  }

  /** Texto para o jogador guardar fora do jogo. */
  exportSave(state: GameState): string {
    return serializeState(state, this.now());
  }

  /** Valida um texto importado. Só substitui o jogo atual se for válido (o atual vira "pre-import"). */
  async importSave(text: string): Promise<GameState> {
    const parsed = deserializeState(text.trim());
    await this.snapshot(KEYS.preImport);
    return parsed.state;
  }
}

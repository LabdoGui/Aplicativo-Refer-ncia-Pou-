/** Armazenamento chave→texto. IndexedDB no navegador, com fallback para localStorage e memória (testes). */
export interface SaveStorage {
  readonly kind: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryStorage implements SaveStorage {
  readonly kind = 'memória';
  data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}

const DB_NAME = 'tycoon-empire';
const STORE = 'saves';

export class IndexedDBStorage implements SaveStorage {
  readonly kind = 'IndexedDB';
  private dbp: Promise<IDBDatabase>;

  constructor() {
    this.dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB bloqueado'));
    });
  }

  private async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbp;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      let result: T;
      req.onsuccess = () => (result = req.result);
      // Só resolve quando a transação foi efetivada (durável), não apenas quando o pedido terminou.
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transação abortada'));
    });
  }

  async get(key: string) {
    const v = await this.run<unknown>('readonly', (s) => s.get(key));
    return typeof v === 'string' ? v : null;
  }
  async set(key: string, value: string) {
    await this.run('readwrite', (s) => s.put(value, key));
  }
  async remove(key: string) {
    await this.run('readwrite', (s) => s.delete(key));
  }
}

export class LocalStorageStorage implements SaveStorage {
  readonly kind = 'localStorage';
  async get(key: string) {
    return localStorage.getItem(`${DB_NAME}:${key}`);
  }
  async set(key: string, value: string) {
    localStorage.setItem(`${DB_NAME}:${key}`, value);
  }
  async remove(key: string) {
    localStorage.removeItem(`${DB_NAME}:${key}`);
  }
}

/** Rejeita se a promessa não terminar no prazo (alguns visualizadores deixam o IndexedDB pendurado). */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Tempo esgotado')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Escolhe o melhor armazenamento disponível no navegador. */
export async function createBrowserStorage(): Promise<SaveStorage> {
  if (typeof indexedDB !== 'undefined') {
    try {
      const s = new IndexedDBStorage();
      await withTimeout(s.get('__probe__'), 2500);
      return s;
    } catch {
      /* cai para localStorage (ex.: navegação privada em alguns navegadores) */
    }
  }
  try {
    localStorage.setItem('__probe__', '1');
    localStorage.removeItem('__probe__');
    return new LocalStorageStorage();
  } catch {
    return new MemoryStorage();
  }
}

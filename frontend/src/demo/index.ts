/**
 * Demonstração no navegador: instala um "servidor" em memória que responde às
 * rotas /api/v1 com os mesmos dados fictícios e as mesmas regras do back-end.
 * Nada sai do aparelho; os dados ficam guardados localmente e recomeçam a cada dia.
 */
import { buildSeedDataset } from '@backend/libs/common/src/seed/dataset';
import { flushEvents } from './core/events';
import { handle, isApiUrl, setAfterRequest, setTokenResolver } from './core/http';
import {
  STATE_VERSION,
  discardState,
  flushPendingSave,
  loadSaved,
  scheduleSave,
  setState,
  type DemoState,
  type SeedContext,
} from './core/state';
import { todayLocal } from './core/support';
import { registerClinical, seedClinical } from './modules/clinical';
import { registerEngagement, seedEngagement } from './modules/engagement';
import { registerGateway } from './modules/gateway';
import { registerIdentity, resolveAccessToken, seedIdentity } from './modules/identity';
import { registerInventory, seedInventory } from './modules/inventory';
import { registerNotification, seedNotification } from './modules/notification';
import { registerScheduling, seedScheduling } from './modules/scheduling';

/** Pequena espera em cada resposta, para a interface mostrar os estados de carregamento. */
const LATENCY_MS = 120;

export function createInitialState(today: string): DemoState {
  const ctx: SeedContext = { dataset: buildSeedDataset(today), today };
  return {
    version: STATE_VERSION,
    seededOn: today,
    identity: seedIdentity(ctx),
    scheduling: seedScheduling(ctx),
    clinical: seedClinical(ctx),
    inventory: seedInventory(ctx),
    engagement: seedEngagement(ctx),
    notification: seedNotification(ctx),
    audit: [],
  };
}

let installed = false;

export function installDemoServer(options: { latencyMs?: number } = {}): void {
  if (installed) return;
  installed = true;

  const today = todayLocal();
  setState(loadSaved(today) ?? createInitialState(today));

  registerIdentity();
  registerScheduling();
  registerClinical();
  registerInventory();
  registerEngagement();
  registerNotification();
  registerGateway();

  setTokenResolver(resolveAccessToken);
  setAfterRequest(() => {
    flushEvents();
    scheduleSave();
  });
  scheduleSave();
  window.addEventListener('pagehide', flushPendingSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSave();
  });

  const latency = options.latencyMs ?? LATENCY_MS;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // Base fixa: dentro de um iframe "srcdoc" o location não serve de base para URLs.
    const url = new URL(href, 'http://pulso.demo');
    if (url.host !== 'pulso.demo' || !isApiUrl(url)) return realFetch(input, init);
    let requestInit = init ?? {};
    if (input instanceof Request) {
      requestInit = {
        method: input.method,
        headers: input.headers,
        body: input.method === 'GET' ? undefined : await input.text(),
        ...init,
      };
    }
    if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
    return handle(url, requestInit);
  };
}

/** Recomeça a demonstração do zero (apaga os dados guardados no aparelho). */
export function resetDemo(): void {
  discardState();
  window.location.hash = '#/';
  window.location.reload();
}

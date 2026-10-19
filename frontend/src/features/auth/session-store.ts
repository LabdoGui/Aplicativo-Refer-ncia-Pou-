import { SESSION_HINT_COOKIE_NAME, type AuthSession, type SessionUser } from '@pulso/contracts';
import { ApiError, apiRequest, setAuthHandlers } from '@/lib/api';

/**
 * Sessão do usuário, guardada SOMENTE em memória (nunca em localStorage).
 * Ao recarregar a página, a sessão volta pelo cookie HttpOnly do refresh token.
 */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  /** Motivo da última saída involuntária (exibido na tela de login). */
  endedReason: 'expired' | null;
}

let state: SessionState = { status: 'loading', user: null, endedReason: null };
let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let pendingRefresh: Promise<string | null> | null = null;
const listeners = new Set<() => void>();

function setState(next: SessionState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export const sessionStore = {
  getState: () => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Renova um minuto antes de o access token vencer (mínimo de 10 s). */
function scheduleRefresh(expiresInSeconds: number): void {
  clearTimeout(refreshTimer);
  const delay = Math.max(10, expiresInSeconds - 60) * 1000;
  refreshTimer = setTimeout(() => void refreshSession(), delay);
}

export function applySession(session: AuthSession): void {
  accessToken = session.accessToken;
  scheduleRefresh(session.expiresIn);
  setState({ status: 'authenticated', user: session.user, endedReason: null });
}

export function clearSession(reason: SessionState['endedReason'] = null): void {
  accessToken = null;
  clearTimeout(refreshTimer);
  setState({ status: 'anonymous', user: null, endedReason: reason });
}

/**
 * Troca o cookie do refresh token por um novo access token. Chamadas simultâneas
 * compartilham a mesma renovação (o servidor rotaciona o token a cada uso).
 * Só um 401 encerra a sessão; falha de rede ou 503 mantém o estado atual.
 */
export function refreshSession(): Promise<string | null> {
  if (!pendingRefresh) {
    const current = renew().finally(() => {
      if (pendingRefresh === current) pendingRefresh = null;
    });
    pendingRefresh = current;
  }
  return pendingRefresh;
}

async function renew(isRetry = false): Promise<string | null> {
  try {
    const session = await apiRequest<AuthSession>('/auth/refresh', { method: 'POST' });
    applySession(session);
    return session.accessToken;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (error.code === 'REFRESH_RACE' && !isRetry) {
        // Outra aba renovou primeiro e o cookie novo já está no navegador.
        await new Promise((resolve) => setTimeout(resolve, 400));
        return renew(true);
      }
      clearSession(state.status === 'authenticated' ? 'expired' : null);
      return null;
    }
    if (state.status === 'loading') clearSession();
    return null;
  }
}

/**
 * Restaura a sessão ao abrir o app. Sem o cookie indicador não há sessão a
 * restaurar: o visitante fica anônimo sem chamar /auth/refresh.
 */
export function restoreSession(): Promise<string | null> {
  const hasHint = document.cookie
    .split(';')
    .some((item) => item.trim() === `${SESSION_HINT_COOKIE_NAME}=1`);
  if (!hasHint) {
    clearSession();
    return Promise.resolve(null);
  }
  return refreshSession();
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
  } finally {
    clearSession();
  }
}

setAuthHandlers({ getAccessToken: () => accessToken, refresh: refreshSession });

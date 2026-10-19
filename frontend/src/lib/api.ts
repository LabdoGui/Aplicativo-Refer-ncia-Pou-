import { API_PREFIX, HEADERS } from '@pulso/contracts';
import { ApiError } from './api-error';

export { ApiError, isApiError, NETWORK_ERROR_MESSAGE } from './api-error';

/** Base de todas as chamadas: o gateway expõe a API em /api/v1 (proxy do Vite/nginx). */
export const API_BASE_URL = `/${API_PREFIX}`;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  /** Corpo serializado como JSON. */
  body?: unknown;
  headers?: HeadersInit;
  /** Sinal de cancelamento (o TanStack Query fornece um em cada queryFn). */
  signal?: AbortSignal;
}

type RequestOptions = Omit<ApiRequestOptions, 'method' | 'body'>;

/**
 * Integração com a sessão (features/auth): o access token fica SOMENTE em memória
 * e o refresh token num cookie HttpOnly (Path=/api/v1/auth), enviado pelo navegador.
 */
export interface AuthHandlers {
  getAccessToken: () => string | null;
  /** Renova a sessão (uma única renovação por vez) e devolve o novo token, ou null. */
  refresh: () => Promise<string | null>;
}

let authHandlers: AuthHandlers = { getAccessToken: () => null, refresh: async () => null };

export function setAuthHandlers(handlers: AuthHandlers): void {
  authHandlers = handlers;
}

/** Rotas de autenticação não disparam renovação automática (evita laços). */
const isAuthPath = (path: string) => path.startsWith('/auth/');

/**
 * Faz a requisição com o token atual. Num 401 de token vencido, renova a sessão
 * uma vez e repete. Um 503 (ex.: AUTH_UNAVAILABLE) nunca derruba a sessão.
 */
async function send(path: string, options: ApiRequestOptions, accept: string): Promise<Response> {
  const attempt = async (token: string | null) => {
    const { method = 'GET', body, signal } = options;
    const headers = new Headers(options.headers);
    headers.set('Accept', accept);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        signal,
      });
    } catch (error) {
      // Cancelamentos (troca de página, refetch) seguem como estão para o TanStack Query.
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw ApiError.network();
    }
  };

  const token = authHandlers.getAccessToken();
  const response = await attempt(token);
  if (response.status !== 401 || !token || isAuthPath(path)) return response;

  const renewed = await authHandlers.refresh();
  return renewed ? attempt(renewed) : response;
}

async function failFrom(response: Response): Promise<never> {
  throw ApiError.fromResponse(
    response.status,
    await readBody(response),
    response.headers.get(HEADERS.requestId) ?? undefined,
  );
}

/** Faz uma requisição JSON à API e devolve o corpo já convertido, ou lança ApiError. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await send(path, options, 'application/json, application/problem+json');
  if (!response.ok) return failFrom(response);
  return (await readBody(response)) as T;
}

/** Baixa um arquivo autenticado (ex.: PDF) como Blob. */
export async function apiGetBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options, 'application/pdf, application/problem+json');
  if (!response.ok) return failFrom(response);
  return response.blob();
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    const text = await response.text().catch(() => '');
    return text || undefined;
  }
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export const apiGet = <T>(path: string, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'GET' });

export const apiPost = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'POST', body });

export const apiPut = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'PUT', body });

export const apiPatch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'PATCH', body });

export const apiDelete = <T = void>(path: string, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'DELETE' });

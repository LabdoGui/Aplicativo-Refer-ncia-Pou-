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

/*
 * PONTO DE EXTENSÃO — FASE 2 (autenticação)
 * O access token ficará SOMENTE em memória (nunca em localStorage), mantido pelo
 * módulo de autenticação, que chamará `setAccessTokenProvider` após o login.
 * O refresh token vai em cookie HttpOnly, por isso usamos `credentials: 'include'`.
 * Também na Fase 2: ao receber 401, tentar POST /auth/refresh uma única vez e repetir
 * a requisição original.
 */
type AccessTokenProvider = () => string | null;
let getAccessToken: AccessTokenProvider = () => null;

export function setAccessTokenProvider(provider: AccessTokenProvider): void {
  getAccessToken = provider;
}

/** Faz uma requisição JSON à API e devolve o corpo já convertido, ou lança ApiError. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json, application/problem+json');
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (error) {
    // Cancelamentos (troca de página, refetch) seguem como estão para o TanStack Query.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw ApiError.network();
  }

  const payload = await readBody(response);
  if (!response.ok) {
    throw ApiError.fromResponse(
      response.status,
      payload,
      response.headers.get(HEADERS.requestId) ?? undefined,
    );
  }
  return payload as T;
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

import { HEADERS } from '@pulso/contracts';

export interface JsonResponse {
  status: number;
  ok: boolean;
  /** Corpo já convertido; `undefined` quando a resposta não é JSON. */
  body: unknown;
  latencyMs: number;
}

export interface FetchJsonOptions {
  timeoutMs: number;
  requestId?: string;
}

/**
 * GET com tempo limite para endpoints de serviço (saúde, OpenAPI).
 * Lança erro em falha de rede ou tempo esgotado; status HTTP de erro não lança.
 */
export async function fetchJson(url: string, options: FetchJsonOptions): Promise<JsonResponse> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.requestId) headers[HEADERS.requestId] = options.requestId;

  const startedAt = performance.now();
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(options.timeoutMs) });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return {
    status: response.status,
    ok: response.ok,
    body,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}

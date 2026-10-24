/**
 * Servidor da demonstração no navegador: um roteador mínimo que responde às
 * mesmas rotas da API real (/api/v1/...), com Problem Details nos erros e os
 * mesmos códigos HTTP do NestJS (POST devolve 201 por padrão).
 */
import {
  API_PREFIX,
  hasPermission,
  type AuthUser,
  type Permission,
  type ProblemDetails,
  type Role,
} from '@pulso/contracts';

export interface FieldIssue {
  field: string;
  message: string;
}

/** Erro de negócio: vira uma resposta application/problem+json. */
export class DemoHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly errors?: FieldIssue[];

  constructor(status: number, code: string, detail: string, title?: string, errors?: FieldIssue[]) {
    super(detail);
    this.status = status;
    this.code = code;
    this.title = title ?? DEFAULT_TITLES[status] ?? 'Erro';
    this.errors = errors;
  }
}

/** Mesmos títulos padrão do ProblemDetailsFilter do back-end. */
const DEFAULT_TITLES: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Autenticação necessária',
  403: 'Acesso negado',
  404: 'Não encontrado',
  409: 'Conflito',
  413: 'Conteúdo grande demais',
  415: 'Formato não suportado',
  422: 'Operação não permitida',
  429: 'Muitas tentativas',
  503: 'Serviço indisponível',
};

/** Mesma assinatura do AppException do back-end: (status, código, detalhe, título?, erros?). */
export function fail(
  status: number,
  code: string,
  detail: string,
  title?: string,
  errors?: FieldIssue[],
): never {
  throw new DemoHttpError(status, code, detail, title, errors);
}

/** Resposta com status, cabeçalhos ou corpo binário específicos. */
export class DemoResponse {
  readonly body: unknown;
  readonly status: number;
  readonly headers: Record<string, string>;

  constructor(body: unknown, status = 200, headers: Record<string, string> = {}) {
    this.body = body;
    this.status = status;
    this.headers = headers;
  }
}

export const ok = (body: unknown) => new DemoResponse(body, 200);
export const created = (body: unknown) => new DemoResponse(body, 201);
export const noContent = () => new DemoResponse(undefined, 204);
export const fileResponse = (blob: Blob, contentType: string) =>
  new DemoResponse(blob, 200, { 'content-type': contentType });

export interface DemoRequest {
  method: string;
  /** Caminho sem o prefixo /api/v1 e sem a query (ex.: /units/123). */
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  // O corpo é JSON livre, validado por cada rota (como os DTOs do back-end).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  /** Usuário do token Bearer (null em rotas públicas sem token). */
  user: AuthUser | null;
  headers: Headers;
}

/** O usuário está garantido nas rotas com auth: 'required' (o padrão). */
export type AuthedRequest = DemoRequest & { user: AuthUser };

export interface RouteOptions {
  /**
   * 'required' (padrão, como o AuthGuard global): exige token válido.
   * 'public': aceita sem token (e anexa o usuário se houver um válido).
   */
  auth?: 'required' | 'public';
  /** Equivalente ao @Roles(...). */
  roles?: Role[];
  /** Equivalente ao @RequirePermissions(...): exige TODAS. */
  permissions?: Permission[];
}

type Handler = (request: AuthedRequest) => unknown | Promise<unknown>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  options: RouteOptions;
}

const routes: Route[] = [];

/** Registra uma rota. Padrão no estilo do Nest: '/units/:id/blocks/:blockId'. */
export function route(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  handler: Handler,
  options: RouteOptions = {},
): void {
  const keys: string[] = [];
  const source = path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  routes.push({ method, pattern: new RegExp(`^${source}/?$`), keys, handler, options });
}

/** Resolve o token Bearer (a sessão fica no estado da demonstração). */
let resolveToken: (token: string) => AuthUser | null = () => null;
export function setTokenResolver(resolver: (token: string) => AuthUser | null): void {
  resolveToken = resolver;
}

/** Chamado depois de cada requisição que pode ter alterado o estado. */
let afterRequest: () => void = () => undefined;
export function setAfterRequest(callback: () => void): void {
  afterRequest = callback;
}

const API_BASE = `/${API_PREFIX}`;

export function isApiUrl(url: URL): boolean {
  return url.pathname === API_BASE || url.pathname.startsWith(`${API_BASE}/`);
}

/** Mesmo formato do ProblemDetailsFilter: type por código, instance com a query e requestId. */
function problem(
  status: number,
  code: string,
  title: string,
  detail: string,
  url: URL,
  errors?: FieldIssue[],
): Response {
  const body: ProblemDetails = {
    type: `https://pulso.local/problems/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status,
    detail,
    instance: `${url.pathname}${url.search}`,
    code,
    requestId: crypto
      .getRandomValues(new Uint32Array(4))
      .reduce((id, n) => id + n.toString(16).padStart(8, '0'), ''),
    ...(errors?.length ? { errors } : {}),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/problem+json; charset=utf-8' },
  });
}

/** Atende uma requisição para /api/v1/... como se fosse o gateway real. */
export async function handle(url: URL, init: RequestInit): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const path = url.pathname.slice(API_BASE.length) || '/';
  const headers = new Headers(init.headers);

  const candidates = routes.filter((candidate) => candidate.pattern.test(path));
  if (candidates.length === 0) {
    return problem(
      404,
      'ROUTE_NOT_FOUND',
      'Não encontrado',
      `Rota ${method} ${path} inexistente.`,
      url,
    );
  }
  const match = candidates.find((candidate) => candidate.method === method);
  if (!match) {
    return problem(
      405,
      'METHOD_NOT_ALLOWED',
      'Método não permitido',
      `Método ${method} não aceito em ${path}.`,
      url,
    );
  }

  const values = match.pattern.exec(path)?.slice(1) ?? [];
  const params = Object.fromEntries(
    match.keys.map((key, i) => [key, decodeURIComponent(values[i])]),
  );

  const authorization = headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const user = token ? resolveToken(token) : null;
  const options = match.options;
  if (options.auth !== 'public' || options.roles || options.permissions) {
    if (!user) {
      return token
        ? problem(
            401,
            'TOKEN_INVALID',
            DEFAULT_TITLES[401],
            'Sua sessão expirou. Entre novamente.',
            url,
          )
        : problem(
            401,
            'AUTH_REQUIRED',
            DEFAULT_TITLES[401],
            'Entre na sua conta para continuar.',
            url,
          );
    }
    if (options.roles && !options.roles.includes(user.role)) {
      return problem(
        403,
        'FORBIDDEN_ROLE',
        DEFAULT_TITLES[403],
        'Seu perfil não tem acesso a esta área.',
        url,
      );
    }
    if ((options.permissions ?? []).some((p) => !hasPermission(user.role, p))) {
      return problem(
        403,
        'FORBIDDEN_PERMISSION',
        DEFAULT_TITLES[403],
        'Você não tem permissão para realizar esta ação.',
        url,
      );
    }
  }

  let body: unknown;
  if (typeof init.body === 'string' && init.body.length > 0) {
    try {
      body = JSON.parse(init.body);
    } catch {
      return problem(
        400,
        'INVALID_JSON',
        'Requisição inválida',
        'O corpo da requisição não é um JSON válido.',
        url,
      );
    }
  }

  try {
    const result = await match.handler({
      method,
      path,
      params,
      query: url.searchParams,
      body: body ?? {},
      user: user as AuthUser,
      headers,
    });
    const response =
      result instanceof DemoResponse
        ? result
        : new DemoResponse(result, method === 'POST' ? 201 : 200);
    if (response.status === 204 || response.body === undefined) {
      return new Response(null, {
        status: response.status === 200 ? 204 : response.status,
        headers: response.headers,
      });
    }
    if (response.body instanceof Blob) {
      return new Response(response.body, { status: response.status, headers: response.headers });
    }
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'content-type': 'application/json; charset=utf-8', ...response.headers },
    });
  } catch (error) {
    if (error instanceof DemoHttpError) {
      return problem(error.status, error.code, error.title, error.message, url, error.errors);
    }
    console.error('[demo] erro inesperado em', method, path, error);
    return problem(
      500,
      'INTERNAL_ERROR',
      'Erro inesperado',
      'Não foi possível concluir a operação agora. Tente novamente em instantes.',
      url,
    );
  } finally {
    if (method !== 'GET') afterRequest();
  }
}

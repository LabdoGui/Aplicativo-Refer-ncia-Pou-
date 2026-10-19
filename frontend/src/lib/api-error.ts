import type { ProblemDetails } from '@pulso/contracts';

export const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

interface ApiErrorInit {
  status: number;
  code: string;
  title: string;
  detail: string;
  requestId?: string;
  fieldErrors?: Record<string, string>;
  payload?: unknown;
}

/** Mensagens amigáveis para respostas de erro que não vieram no formato Problem Details. */
const FALLBACK_BY_STATUS: Record<number, Pick<ApiErrorInit, 'code' | 'title' | 'detail'>> = {
  401: {
    code: 'UNAUTHENTICATED',
    title: 'Sessão necessária',
    detail: 'Entre na sua conta para continuar.',
  },
  403: {
    code: 'FORBIDDEN',
    title: 'Acesso negado',
    detail: 'Você não tem permissão para acessar este recurso.',
  },
  404: {
    code: 'NOT_FOUND',
    title: 'Não encontrado',
    detail: 'O recurso solicitado não foi encontrado.',
  },
  429: {
    code: 'TOO_MANY_REQUESTS',
    title: 'Muitas tentativas',
    detail: 'Você fez muitas solicitações seguidas. Aguarde um pouco e tente novamente.',
  },
};

const SERVICE_UNAVAILABLE = {
  code: 'SERVICE_UNAVAILABLE',
  title: 'Serviço indisponível',
  detail: 'O servidor está temporariamente indisponível. Tente novamente em instantes.',
};

const UNEXPECTED = {
  code: 'UNEXPECTED_ERROR',
  title: 'Erro inesperado',
  detail: 'Não foi possível concluir a solicitação. Tente novamente em instantes.',
};

/** Erro de API normalizado (RFC 9457 – Problem Details) para uso em toda a interface. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly requestId?: string;
  readonly fieldErrors: Record<string, string>;
  /** Corpo bruto da resposta, quando houver (útil para respostas 503 com conteúdo). */
  readonly payload?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.detail);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.requestId = init.requestId;
    this.fieldErrors = init.fieldErrors ?? {};
    this.payload = init.payload;
  }

  /** Falha de rede (servidor fora do ar, sem internet, CORS etc.). */
  static network(): ApiError {
    return new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      title: 'Sem conexão com o servidor',
      detail: NETWORK_ERROR_MESSAGE,
    });
  }

  /** Converte uma resposta HTTP de erro em ApiError. */
  static fromResponse(status: number, payload: unknown, headerRequestId?: string): ApiError {
    if (isProblemDetails(payload)) {
      return new ApiError({
        status,
        code: payload.code ?? `HTTP_${status}`,
        title: payload.title,
        detail: payload.detail ?? payload.title,
        requestId: payload.requestId ?? headerRequestId,
        fieldErrors: toFieldErrors(payload.errors),
        payload,
      });
    }

    // Os serviços sempre respondem erros 5xx como Problem Details; um 5xx sem esse formato
    // vem da infraestrutura (proxy do Vite/nginx sem acesso ao gateway): serviço indisponível.
    const fallback =
      FALLBACK_BY_STATUS[status] ?? (status >= 500 ? SERVICE_UNAVAILABLE : UNEXPECTED);
    return new ApiError({ status, ...fallback, requestId: headerRequestId, payload });
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isProblemDetails(value: unknown): value is Partial<ProblemDetails> & { title: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { title?: unknown }).title === 'string' &&
    typeof (value as { status?: unknown }).status === 'number'
  );
}

function toFieldErrors(errors: ProblemDetails['errors']): Record<string, string> {
  if (!Array.isArray(errors)) return {};
  return Object.fromEntries(errors.map(({ field, message }) => [field, message]));
}

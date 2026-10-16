import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ProblemDetails } from '@pulso/contracts';
import { AppException } from './app.exception';

const DEFAULTS: Record<number, { code: string; title: string; detail: string }> = {
  400: {
    code: 'BAD_REQUEST',
    title: 'Requisição inválida',
    detail: 'Verifique os dados informados e tente novamente.',
  },
  401: {
    code: 'UNAUTHENTICATED',
    title: 'Autenticação necessária',
    detail: 'Sua sessão expirou ou você não está conectado. Entre novamente.',
  },
  403: {
    code: 'FORBIDDEN',
    title: 'Acesso negado',
    detail: 'Você não tem permissão para realizar esta ação.',
  },
  404: {
    code: 'NOT_FOUND',
    title: 'Não encontrado',
    detail: 'O recurso solicitado não foi encontrado.',
  },
  409: {
    code: 'CONFLICT',
    title: 'Conflito',
    detail:
      'A operação conflita com o estado atual dos dados. Atualize a página e tente novamente.',
  },
  422: {
    code: 'UNPROCESSABLE',
    title: 'Operação não permitida',
    detail: 'Não foi possível concluir a operação com os dados informados.',
  },
  429: {
    code: 'TOO_MANY_REQUESTS',
    title: 'Muitas tentativas',
    detail: 'Você fez muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.',
  },
  503: {
    code: 'SERVICE_UNAVAILABLE',
    title: 'Serviço indisponível',
    detail:
      'Um serviço necessário está temporariamente indisponível. Tente novamente em instantes.',
  },
};

const INTERNAL = {
  code: 'INTERNAL_ERROR',
  title: 'Erro inesperado',
  detail: 'Não foi possível concluir a operação agora. Tente novamente em instantes.',
};

interface PrismaLikeError {
  code: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'PrismaClientKnownRequestError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/**
 * Converte qualquer exceção em RFC 9457 (Problem Details) com mensagem amigável.
 * Erros 5xx são registrados com stack trace; o cliente recebe apenas uma
 * mensagem genérica e o `requestId` para suporte.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemDetailsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const requestId = (request.id as string | undefined) ?? request.header('x-request-id');

    const problem = this.toProblem(exception);
    problem.instance = request.originalUrl;
    problem.requestId = requestId;

    if (problem.status >= 500 && exception instanceof AppException) {
      // Falha prevista (ex.: serviço dependente fora do ar): quem lançou já registrou o detalhe.
      this.logger.warn(
        { requestId, path: request.originalUrl, code: problem.code },
        `Erro ${problem.status} tratado`,
      );
    } else if (problem.status >= 500) {
      this.logger.error(
        { err: exception, requestId, path: request.originalUrl },
        `Erro ${problem.status} não tratado`,
      );
    } else if (problem.status === 401 || problem.status === 403) {
      this.logger.warn(
        { requestId, path: request.originalUrl, code: problem.code },
        'Acesso negado',
      );
    }

    if (!response.headersSent) {
      response.status(problem.status).type('application/problem+json').json(problem);
    }
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof AppException) {
      const base = DEFAULTS[exception.getStatus()] ?? INTERNAL;
      return this.build(
        exception.getStatus(),
        exception.code,
        exception.title ?? base.title,
        exception.message,
        exception.fieldErrors,
      );
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const base = DEFAULTS[status] ?? (status >= 500 ? INTERNAL : DEFAULTS[400]);
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const { code, message, title, errors } = body as {
          code?: string;
          message?: string | string[];
          title?: string;
          errors?: Array<{ field: string; message: string }>;
        };
        // Mensagens técnicas do framework (em inglês) não chegam ao usuário final.
        const isFriendly = typeof code === 'string' && typeof message === 'string';
        return this.build(
          status,
          code ?? base.code,
          title ?? base.title,
          isFriendly && status < 500 ? (message as string) : base.detail,
          errors,
        );
      }
      return this.build(status, base.code, base.title, base.detail);
    }

    if (isPrismaKnownError(exception)) {
      if (exception.code === 'P2002') {
        return this.build(
          409,
          'DUPLICATE',
          DEFAULTS[409].title,
          'Já existe um registro com esses dados.',
        );
      }
      if (exception.code === 'P2025') {
        return this.build(404, DEFAULTS[404].code, DEFAULTS[404].title, DEFAULTS[404].detail);
      }
    }

    return this.build(
      HttpStatus.INTERNAL_SERVER_ERROR,
      INTERNAL.code,
      INTERNAL.title,
      INTERNAL.detail,
    );
  }

  private build(
    status: number,
    code: string,
    title: string,
    detail: string,
    errors?: Array<{ field: string; message: string }>,
  ): ProblemDetails {
    return {
      type: `https://pulso.local/problems/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      detail,
      code,
      ...(errors && errors.length > 0 ? { errors } : {}),
    };
  }
}

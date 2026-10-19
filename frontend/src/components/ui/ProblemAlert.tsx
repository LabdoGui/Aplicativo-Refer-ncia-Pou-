import type { ReactNode } from 'react';
import { Alert, type AlertTone } from './Alert';
import { isApiError } from '@/lib/api';

const GENERIC_DETAIL = 'Não foi possível concluir agora. Tente novamente em instantes.';

/**
 * Texto amigável de um erro da API: o `detail` do servidor nos erros 4xx; nos 5xx,
 * a mensagem genérica com o código da requisição (para o suporte).
 */
export function problemText(error: unknown): { title: string; detail: string; requestId?: string } {
  if (!isApiError(error)) return { title: 'Algo deu errado', detail: GENERIC_DETAIL };
  if (error.status >= 500 || error.status === 0) {
    return {
      title: error.status === 0 ? error.title : 'Serviço indisponível',
      detail: error.status === 0 ? error.detail : GENERIC_DETAIL,
      requestId: error.requestId,
    };
  }
  return { title: error.title, detail: error.detail };
}

interface ProblemAlertProps {
  error: unknown;
  title?: string;
  tone?: AlertTone;
  actions?: ReactNode;
  className?: string;
}

/** Erro de uma ação (envio, cancelamento…), anunciado assim que aparece. */
export function ProblemAlert({
  error,
  title,
  tone = 'critical',
  actions,
  className,
}: ProblemAlertProps) {
  if (!error) return null;
  const text = problemText(error);
  return (
    <Alert
      tone={tone}
      role="alert"
      title={title ?? text.title}
      actions={actions}
      className={className}
    >
      <p>{text.detail}</p>
      {text.requestId && (
        <p className="mt-1 text-xs text-ink-muted">Código para suporte: {text.requestId}</p>
      )}
    </Alert>
  );
}

/** Código do erro da API (ou undefined). */
export const errorCode = (error: unknown): string | undefined =>
  isApiError(error) ? error.code : undefined;

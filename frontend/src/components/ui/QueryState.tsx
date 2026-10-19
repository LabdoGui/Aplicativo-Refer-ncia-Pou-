import type { ReactNode } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { isApiError } from '@/lib/api';

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  /** Texto do carregamento (ex.: "Carregando seus agendamentos…"). */
  loadingLabel?: string;
  children: ReactNode;
}

/** Estados padrão de uma consulta: carregando, erro amigável com "Tentar novamente" e conteúdo. */
export function QueryState({
  isLoading,
  error,
  onRetry,
  loadingLabel = 'Carregando…',
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div role="status" className="flex items-center gap-3 py-10 text-ink-muted">
        <Spinner /> {loadingLabel}
      </div>
    );
  }
  if (error) {
    return (
      <Alert
        tone="critical"
        role="alert"
        title={isApiError(error) ? error.title : 'Não foi possível carregar'}
        actions={
          onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Tentar novamente
            </Button>
          )
        }
      >
        {isApiError(error) ? error.detail : 'Tente novamente em instantes.'}
      </Alert>
    );
  }
  return children;
}

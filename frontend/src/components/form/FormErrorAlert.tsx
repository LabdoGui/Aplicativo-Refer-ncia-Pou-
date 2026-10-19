import { Alert } from '@/components/ui';
import { isApiError } from '@/lib/api';

/** Erro geral de envio de formulário, com o código da requisição para o suporte. */
export function FormErrorAlert({ error, title }: { error: unknown; title?: string }) {
  if (!error) return null;
  const detail = isApiError(error) ? error.detail : 'Não foi possível concluir. Tente novamente.';
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <Alert tone="critical" role="alert" title={title ?? (isApiError(error) ? error.title : 'Erro')}>
      <p>{detail}</p>
      {requestId && <p className="mt-1 text-xs text-ink-muted">Código para suporte: {requestId}</p>}
    </Alert>
  );
}

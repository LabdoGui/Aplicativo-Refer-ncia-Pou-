import { X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button } from '@/components/ui';

const PARAM = 'conta-excluida';

/** Aviso exibido depois da exclusão da conta (/?conta-excluida=1), que pode ser fechado. */
export function AccountDeletedNotice() {
  const [params, setParams] = useSearchParams();
  if (params.get(PARAM) !== '1') return null;

  function dismiss() {
    const next = new URLSearchParams(params);
    next.delete(PARAM);
    setParams(next, { replace: true });
  }

  return (
    <div className="mx-auto max-w-page px-4 pt-6 sm:px-6">
      <Alert
        tone="ok"
        role="status"
        title="Sua conta foi excluída"
        actions={
          <Button variant="ghost" size="sm" onClick={dismiss}>
            <X aria-hidden="true" className="size-4" />
            Fechar aviso
          </Button>
        }
      >
        Apagamos seus dados de identificação. Obrigado por ter feito parte do Pulso.
      </Alert>
    </div>
  );
}

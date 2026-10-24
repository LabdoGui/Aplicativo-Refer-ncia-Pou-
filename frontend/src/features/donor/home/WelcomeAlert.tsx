import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button } from '@/components/ui';
import { LiveMessage } from '@/features/donor/booking/LiveMessage';

const PARAM = 'boas-vindas';

/** Boas-vindas após o cadastro (?boas-vindas=1). O parâmetro sai da URL logo em seguida. */
export function WelcomeAlert() {
  const [params, setParams] = useSearchParams();
  const [visible, setVisible] = useState(() => params.get(PARAM) === '1');

  useEffect(() => {
    if (!params.has(PARAM)) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(PARAM);
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  if (!visible) return null;
  return (
    <LiveMessage>
      <Alert
        tone="ok"
        title="Boas-vindas ao SangueConecta!"
        className="mb-6"
        actions={
          <Button variant="ghost" size="sm" onClick={() => setVisible(false)}>
            Fechar aviso
          </Button>
        }
      >
        Sua conta está pronta. Quando quiser, responda a pré-triagem e agende sua doação.
      </Alert>
    </LiveMessage>
  );
}

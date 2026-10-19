import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { copyText } from './copy-text';

type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * Copia o link de verificação; se não der, mostra o link para copiar à mão.
 * Pensado para uma linha flex-wrap: o campo alternativo ocupa a linha inteira.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [status, setStatus] = useState<CopyStatus>('idle');

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = window.setTimeout(() => setStatus('idle'), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function handleCopy() {
    setStatus((await copyText(url)) ? 'copied' : 'failed');
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleCopy}>
        {status === 'copied' ? (
          <Check aria-hidden="true" className="size-4 text-ok-strong" />
        ) : (
          <Link2 aria-hidden="true" className="size-4" />
        )}
        {status === 'copied' ? 'Link copiado' : 'Copiar link'}
      </Button>
      <span role="status" className="sr-only">
        {status === 'copied' ? 'Link de verificação copiado.' : ''}
      </span>
      {status === 'failed' && (
        <div className="basis-full pb-3 pl-3 text-sm text-ink-muted">
          <p>Não foi possível copiar automaticamente. Selecione e copie o link:</p>
          <input
            readOnly
            value={url}
            aria-label="Link de verificação"
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 block min-h-11 w-full rounded-control border border-line-strong/60 bg-surface px-3 font-mono text-sm text-ink"
          />
        </div>
      )}
    </>
  );
}

import type { Ref } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import type { DocumentView } from '@pulso/contracts';
import { FormErrorAlert } from '@/components/form';
import { Alert, Button, buttonStyles } from '@/components/ui';
import { useDocumentPdf } from './use-document-pdf';
import { documentFileName } from './verification';

interface PdfActionsProps {
  document: Pick<DocumentView, 'id' | 'type' | 'issuedAt'>;
  /** Permite levar o foco ao botão logo depois de gerar o documento. */
  buttonRef?: Ref<HTMLButtonElement>;
}

/** "Visualizar PDF" com alternativa para bloqueadores de nova aba (abrir ou baixar). */
export function PdfActions({ document, buttonRef }: PdfActionsProps) {
  const { state, view } = useDocumentPdf(document.id);
  const fileName = documentFileName(document);

  return (
    <div className="space-y-3">
      <Button ref={buttonRef} variant="outline" loading={state.status === 'loading'} onClick={view}>
        {state.status !== 'loading' && <FileText aria-hidden="true" className="size-4" />}
        Visualizar PDF
      </Button>
      <div aria-live="polite">
        {state.status === 'ready' &&
          (state.popupBlocked ? (
            <Alert tone="warn" title="O navegador bloqueou a nova aba">
              <p>Use um dos links abaixo para abrir ou baixar o PDF.</p>
              <FileLinks url={state.url} fileName={fileName} />
            </Alert>
          ) : (
            <div className="text-sm text-ink-muted">
              <p>O PDF foi aberto em uma nova aba. Não abriu?</p>
              <FileLinks url={state.url} fileName={fileName} />
            </div>
          ))}
        {state.status === 'error' && (
          <FormErrorAlert error={state.error} title="Não foi possível abrir o PDF" />
        )}
      </div>
    </div>
  );
}

function FileLinks({ url, fileName }: { url: string; fileName: string }) {
  const linkClass = buttonStyles({ variant: 'ghost', size: 'sm', className: '-ml-3' });
  return (
    <div className="mt-1 flex flex-wrap gap-x-4">
      <a href={url} target="_blank" rel="noopener" className={linkClass}>
        <ExternalLink aria-hidden="true" className="size-4" />
        Abrir PDF<span className="sr-only"> (abre em nova aba)</span>
      </a>
      <a href={url} download={fileName} className={linkClass}>
        <Download aria-hidden="true" className="size-4" />
        Baixar PDF
      </a>
    </div>
  );
}

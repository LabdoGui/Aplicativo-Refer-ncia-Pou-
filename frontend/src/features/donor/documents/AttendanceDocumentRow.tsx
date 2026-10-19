import { useEffect, useRef, useState } from 'react';
import { FileCheck2, FilePlus2 } from 'lucide-react';
import { DOCUMENT_TYPE_LABELS, type DocumentType, type DocumentView } from '@pulso/contracts';
import { FormErrorAlert } from '@/components/form';
import { Button } from '@/components/ui';
import { useIssueDocument } from '@/features/donor/api';
import { formatDateTime } from '@/lib/format';
import { PdfActions } from './PdfActions';
import { VerificationCode } from './VerificationCode';

interface AttendanceDocumentRowProps {
  attendanceId: string;
  type: DocumentType;
  description: string;
  /** Documento já emitido (da lista "Meus documentos"). */
  document?: DocumentView;
}

/** Uma declaração do atendimento: gerar (idempotente) → visualizar PDF → verificar. */
export function AttendanceDocumentRow({
  attendanceId,
  type,
  description,
  document,
}: AttendanceDocumentRowProps) {
  const issue = useIssueDocument();
  const current = document ?? issue.data;
  const pdfButton = useRef<HTMLButtonElement>(null);
  const [justIssued, setJustIssued] = useState(false);
  const label = DOCUMENT_TYPE_LABELS[type];

  // O botão "Gerar" some ao concluir: o foco vai para "Visualizar PDF" (não se perde).
  useEffect(() => {
    if (justIssued && current) pdfButton.current?.focus();
  }, [justIssued, current]);

  function handleIssue() {
    issue.mutate({ attendanceId, type }, { onSuccess: () => setJustIssued(true) });
  }

  const Icon = current ? FileCheck2 : FilePlus2;
  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-base font-semibold text-ink">{label}</h3>
          <p className="text-sm text-ink-muted">{description}</p>
          {current && (
            <p className="mt-1 text-sm text-ink-muted">
              Emitida em {formatDateTime(current.issuedAt)}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 sm:pl-15">
        {current ? (
          <div className="space-y-4">
            <PdfActions document={current} buttonRef={pdfButton} />
            <VerificationCode code={current.verificationCode} />
          </div>
        ) : (
          <Button variant="secondary" loading={issue.isPending} onClick={handleIssue}>
            Gerar documento
          </Button>
        )}
        <p role="status" className="sr-only">
          {justIssued && current ? `${label} gerada. Você já pode visualizar o PDF.` : ''}
        </p>
        {issue.error ? (
          <div className="mt-3">
            <FormErrorAlert error={issue.error} title="Não foi possível gerar o documento" />
          </div>
        ) : null}
      </div>
    </li>
  );
}

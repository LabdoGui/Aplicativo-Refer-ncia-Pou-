import { FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentView,
  type DonorAttendanceView,
} from '@pulso/contracts';
import { Card } from '@/components/ui';
import { formatDate, formatDateTime } from '@/lib/format';
import { PdfActions } from './PdfActions';
import { VerificationCode } from './VerificationCode';

interface DocumentCardProps {
  document: DocumentView;
  /** Atendimento de origem, quando já carregado (mostra data e unidade). */
  attendance?: DonorAttendanceView;
}

/** Documento emitido, na lista "Meus documentos". */
export function DocumentCard({ document, attendance }: DocumentCardProps) {
  const typeLabel = DOCUMENT_TYPE_LABELS[document.type];
  return (
    <Card as="li">
      <div className="flex gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
          <FileCheck2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          {document.title !== typeLabel && (
            <p className="text-xs font-semibold tracking-wide text-petroleo-700 uppercase">
              {typeLabel}
            </p>
          )}
          <h2 className="text-lg font-bold text-ink">{document.title}</h2>
          <p className="text-sm text-ink-muted">Emitido em {formatDateTime(document.issuedAt)}</p>
          <p className="mt-1 text-sm">
            <Link
              to={`/app/doacoes/${document.attendanceId}`}
              className="inline-flex min-h-11 items-center font-semibold text-petroleo-700 underline-offset-4 hover:underline"
            >
              {attendance
                ? `Atendimento de ${formatDate(attendance.attendedAt)} · ${attendance.unitName}`
                : 'Ver atendimento'}
            </Link>
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-4 sm:pl-15">
        <PdfActions document={document} />
        <VerificationCode code={document.verificationCode} />
      </div>
    </Card>
  );
}

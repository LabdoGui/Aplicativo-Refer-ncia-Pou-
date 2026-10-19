import { Info } from 'lucide-react';
import {
  DOCUMENT_DISCLAIMER,
  type DocumentType,
  type DocumentView,
  type DonorAttendanceView,
} from '@pulso/contracts';
import { Card, QueryState } from '@/components/ui';
import { useDocuments } from '@/features/donor/api';
import { isCompletedDonation } from '@/features/donor/history/outcome';
import { AttendanceDocumentRow } from './AttendanceDocumentRow';

const DESCRIPTIONS: Record<DocumentType, string> = {
  ATTENDANCE_DECLARATION: 'Comprova que você compareceu à unidade de coleta nesta data.',
  DONATION_DECLARATION: 'Comprova a doação de sangue concluída nesta data.',
};

/**
 * Documentos de um atendimento: a declaração de comparecimento sempre; a de doação
 * só quando a doação foi concluída (a API recusa nos outros casos). O id "documentos"
 * é o destino do link "Gerar declaração" da tela de agradecimento.
 */
export function AttendanceDocuments({ attendance }: { attendance: DonorAttendanceView }) {
  const documents = useDocuments();
  const types: DocumentType[] = isCompletedDonation(attendance)
    ? ['ATTENDANCE_DECLARATION', 'DONATION_DECLARATION']
    : ['ATTENDANCE_DECLARATION'];
  const issued = (type: DocumentType): DocumentView | undefined =>
    documents.data?.find((doc) => doc.attendanceId === attendance.id && doc.type === type);

  return (
    <Card
      as="section"
      id="documentos"
      tabIndex={-1}
      aria-labelledby="documentos-titulo"
      className="scroll-mt-24"
    >
      <h2 id="documentos-titulo" className="text-lg font-bold text-ink">
        Documentos
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Gere a declaração quando precisar. Cada documento tem um código para conferir a
        autenticidade.
      </p>
      <QueryState
        isLoading={documents.isLoading}
        error={documents.error}
        onRetry={() => documents.refetch()}
        loadingLabel="Carregando documentos…"
      >
        <ul className="mt-5 divide-y divide-line">
          {types.map((type) => (
            <AttendanceDocumentRow
              key={type}
              attendanceId={attendance.id}
              type={type}
              description={DESCRIPTIONS[type]}
              document={issued(type)}
            />
          ))}
        </ul>
      </QueryState>
      <p className="mt-5 flex gap-2 rounded-control bg-canvas p-3 text-sm text-ink-muted">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-petroleo-700" />
        {DOCUMENT_DISCLAIMER}
      </p>
    </Card>
  );
}

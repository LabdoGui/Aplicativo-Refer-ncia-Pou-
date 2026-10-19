import { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { PageHeader, QueryState } from '@/components/ui';
import { useAttendance } from '@/features/donor/api';
import { AttendanceDocuments } from '@/features/donor/documents/AttendanceDocuments';
import { AttendanceSummary } from '@/features/donor/history/AttendanceSummary';
import { BackLink } from '@/features/donor/history/BackLink';
import { formatFullDate } from '@/features/donor/history/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Detalhe de um atendimento: desfecho, volume e declarações (comparecimento e doação). */
export function AttendanceDetailPage() {
  useDocumentTitle('Atendimento');
  const { attendanceId = '' } = useParams();
  const { hash } = useLocation();
  const attendance = useAttendance(attendanceId);
  const data = attendance.data;
  const scrolledToDocuments = useRef(false);

  // Chegando por "Gerar declaração" (#documentos), leva a seção à vista e o foco até ela,
  // uma única vez (as atualizações do atendimento depois de gerar não roubam o foco).
  useEffect(() => {
    if (!data || hash !== '#documentos' || scrolledToDocuments.current) return;
    scrolledToDocuments.current = true;
    const section = document.getElementById('documentos');
    section?.scrollIntoView({ block: 'start' });
    section?.focus({ preventScroll: true });
  }, [data, hash]);

  return (
    <>
      <BackLink to="/app/doacoes">Minhas doações</BackLink>
      <PageHeader
        eyebrow={data ? 'Atendimento' : undefined}
        title={data ? formatFullDate(data.attendedAt) : 'Atendimento'}
        description={data?.unitName}
      />
      <QueryState
        isLoading={attendance.isLoading}
        error={attendance.error}
        onRetry={() => attendance.refetch()}
        loadingLabel="Carregando atendimento…"
      >
        {data && (
          <div className="space-y-6">
            <AttendanceSummary attendance={data} />
            <AttendanceDocuments attendance={data} />
          </div>
        )}
      </QueryState>
    </>
  );
}

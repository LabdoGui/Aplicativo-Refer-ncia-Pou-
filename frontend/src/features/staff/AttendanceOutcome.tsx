import { CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DONATION_STATUS_LABELS,
  SCREENING_RESULT_LABELS,
  type AttendanceStaffView,
} from '@pulso/contracts';
import { buttonStyles, Card } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

/** Resumo do atendimento já registrado. */
export function AttendanceOutcome({
  attendance,
  backTo,
}: {
  attendance: AttendanceStaffView;
  backTo: string;
}) {
  return (
    <Card as="section" aria-labelledby="resumo-titulo" className="space-y-4">
      <div className="flex items-center gap-2">
        <CircleCheck aria-hidden="true" className="size-5 text-ok" />
        <h2 id="resumo-titulo" className="text-lg font-bold text-ink">
          {attendance.completed ? 'Atendimento finalizado' : 'Triagem registrada'}
        </h2>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">Resultado da triagem</dt>
          <dd className="font-semibold text-ink">{SCREENING_RESULT_LABELS[attendance.result]}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Profissional</dt>
          <dd className="font-semibold text-ink">{attendance.professionalName}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Registrado em</dt>
          <dd className="font-semibold text-ink">{formatDateTime(attendance.createdAt)}</dd>
        </div>
        {attendance.donation && (
          <div>
            <dt className="text-ink-muted">Doação</dt>
            <dd className="font-semibold text-ink">
              {DONATION_STATUS_LABELS[attendance.donation.status]} · {attendance.donation.code}
            </dd>
          </div>
        )}
      </dl>
      {attendance.completed && (
        <Link to={backTo} className={buttonStyles({ variant: 'outline' })}>
          Voltar para a agenda
        </Link>
      )}
    </Card>
  );
}

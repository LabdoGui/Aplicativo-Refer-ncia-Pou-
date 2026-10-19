import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DonorAttendanceView } from '@pulso/contracts';
import { Card } from '@/components/ui';
import { formatLongDate, formatNumber, formatTime } from '@/lib/format';
import { OutcomeBadge } from './OutcomeBadge';
import { attendanceOutcome, isCompletedDonation } from './outcome';

/** Resumo do atendimento para o doador: data, local, campanha e desfecho da doação. */
export function AttendanceSummary({ attendance }: { attendance: DonorAttendanceView }) {
  const { description } = attendanceOutcome(attendance);
  const donation = attendance.donation;
  const completed = isCompletedDonation(attendance);

  return (
    <Card as="section" aria-labelledby="resumo-atendimento">
      <h2 id="resumo-atendimento" className="sr-only">
        Resumo do atendimento
      </h2>
      <div className="flex flex-col gap-2">
        <div>
          <OutcomeBadge attendance={attendance} />
        </div>
        <p className="text-ink">{description}</p>
      </div>
      <dl className="mt-5 grid gap-4 rounded-card bg-canvas p-4 text-sm sm:grid-cols-2">
        <Item label="Data e horário">
          {formatLongDate(attendance.attendedAt)}, às {formatTime(attendance.attendedAt)}
        </Item>
        <Item label="Unidade">{attendance.unitName}</Item>
        <Item label="Campanha">{attendance.campaignTitle ?? 'Sem campanha vinculada'}</Item>
        {completed && donation?.volumeMl != null && (
          <Item label="Volume coletado">{formatNumber(donation.volumeMl)} mL</Item>
        )}
        {donation && (
          <Item label="Código da doação">
            <span className="font-mono">{donation.code}</span>
          </Item>
        )}
      </dl>
      {completed && (
        <Link
          to={`/app/doacoes/${attendance.id}/obrigado`}
          className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-petroleo-700 underline-offset-4 hover:underline"
        >
          O que acontece com a sua doação
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </Card>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold text-ink">{children}</dd>
    </div>
  );
}

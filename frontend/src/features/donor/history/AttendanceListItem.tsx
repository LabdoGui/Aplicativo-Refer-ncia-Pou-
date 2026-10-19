import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DonorAttendanceView } from '@pulso/contracts';
import { dateTileParts, formatFullDate } from './format';
import { OutcomeBadge } from './OutcomeBadge';

/** Um atendimento na lista "Minhas doações": o cartão inteiro leva ao detalhe. */
export function AttendanceListItem({ attendance }: { attendance: DonorAttendanceView }) {
  const tile = dateTileParts(attendance.attendedAt);
  return (
    <li className="relative flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-petroleo-300 has-[a:focus-visible]:outline-[3px] has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-petroleo-600 sm:p-5">
      <span
        aria-hidden="true"
        className="flex w-14 shrink-0 flex-col items-center rounded-control bg-petroleo-50 py-2 text-petroleo-800"
      >
        <span className="text-xs font-semibold uppercase">{tile.month}</span>
        <span className="font-display text-2xl leading-none font-bold">{tile.day}</span>
        <span className="mt-0.5 text-[0.6875rem] font-medium">{tile.year}</span>
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-sans text-base font-semibold text-ink">
          <Link
            to={`/app/doacoes/${attendance.id}`}
            className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
          >
            {formatFullDate(attendance.attendedAt)}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-sm text-ink-muted">{attendance.unitName}</p>
        {attendance.campaignTitle && (
          <p className="truncate text-sm text-ink-muted">Campanha: {attendance.campaignTitle}</p>
        )}
        <div className="mt-2">
          <OutcomeBadge attendance={attendance} />
        </div>
      </div>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
    </li>
  );
}

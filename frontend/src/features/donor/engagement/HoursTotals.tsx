import { HOURS_STATUS_LABELS, HOURS_STATUSES, type HoursStatus } from '@pulso/contracts';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { HOURS_STATUS_STYLE } from './HoursStatusBadge';

const ICON_COLOR: Record<HoursStatus, string> = {
  PENDING: 'text-warn',
  APPROVED: 'text-ok',
  REJECTED: 'text-ink-muted',
};

/** Total de horas por situação (aguardando, aprovadas, não aprovadas). */
export function HoursTotals({ totals }: { totals: Record<HoursStatus, number> }) {
  return (
    <Card as="section" aria-labelledby="totais-horas">
      <h2 id="totais-horas" className="text-lg font-bold text-ink">
        Suas horas
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {HOURS_STATUSES.map((status) => {
          const Icon = HOURS_STATUS_STYLE[status].icon;
          return (
            <div
              key={status}
              className="flex items-center justify-between gap-3 rounded-control bg-canvas px-4 py-3 sm:flex-col sm:items-start"
            >
              <dt className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                <Icon aria-hidden="true" className={cn('size-4 shrink-0', ICON_COLOR[status])} />
                {HOURS_STATUS_LABELS[status]}
              </dt>
              <dd className="font-display text-2xl font-bold text-ink tabular-nums">
                {formatNumber(totals[status] ?? 0)} h
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-xs text-ink-muted">
        Só as horas aprovadas pela instituição contam como horas complementares.
      </p>
    </Card>
  );
}

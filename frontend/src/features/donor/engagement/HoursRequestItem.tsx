import type { ComplementaryHoursView } from '@pulso/contracts';
import { formatDate, formatNumber } from '@/lib/format';
import { HoursStatusBadge } from './HoursStatusBadge';

/** Um pedido de horas: instituição, doação de origem, horas, situação e observação. */
export function HoursRequestItem({ item }: { item: ComplementaryHoursView }) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{item.institution.name}</p>
        <p className="text-sm text-ink-muted">
          Doação de {formatDate(item.donatedAt)} · {formatNumber(item.hours)}{' '}
          {item.hours === 1 ? 'hora' : 'horas'}
        </p>
        {item.reviewedAt && (
          <p className="text-sm text-ink-muted">Analisado em {formatDate(item.reviewedAt)}</p>
        )}
        {item.reviewNote && (
          <p className="mt-2 rounded-control bg-canvas p-3 text-sm text-ink">
            <span className="font-semibold">Observação da instituição:</span> {item.reviewNote}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <HoursStatusBadge status={item.status} />
      </div>
    </li>
  );
}

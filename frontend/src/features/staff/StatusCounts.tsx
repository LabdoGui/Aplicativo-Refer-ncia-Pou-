import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from '@pulso/contracts';

/** Resumo do dia: quantos atendimentos em cada situação (só as que aparecem). */
export function StatusCounts({ counts }: { counts: Record<AppointmentStatus, number> }) {
  const visible = APPOINTMENT_STATUSES.filter((status) => counts[status] > 0);
  if (visible.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Resumo do dia">
      {visible.map((status) => (
        <li key={status} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
          <span className="font-semibold text-ink tabular-nums">{counts[status]}</span>{' '}
          <span className="text-ink-muted">{APPOINTMENT_STATUS_LABELS[status].toLowerCase()}</span>
        </li>
      ))}
    </ul>
  );
}

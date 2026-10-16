import { Card, Spinner, StatusPill } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { OVERALL_SUMMARY, presentServiceStatus } from './status-presentation';
import type { ServicesHealth } from './types';

interface OverallStatusProps {
  health: ServicesHealth;
  isRefreshing: boolean;
}

export function OverallStatus({ health, isRefreshing }: OverallStatusProps) {
  const status = presentServiceStatus(health.status);
  const summary =
    OVERALL_SUMMARY[health.status as keyof typeof OVERALL_SUMMARY] ??
    'Não foi possível interpretar o estado geral.';

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Só o resumo é anunciado (quando muda); o horário fica fora para não repetir a cada 10 s. */}
      <div aria-live="polite" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <StatusPill status={status.tone} label={status.label} />
        <p className="font-semibold text-ink">{summary}</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        {isRefreshing && <Spinner size="sm" className="text-petroleo-600" />}
        <span>
          Última verificação:{' '}
          <span className="tabular-nums">{formatDateTime(health.checkedAt)}</span>
        </span>
      </div>
    </Card>
  );
}

import { Card, Spinner, StatusPill } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { STALE_OVERALL_STATUS, overallSummary, presentServiceStatus } from './status-presentation';
import type { ServicesHealth } from './types';

interface OverallStatusProps {
  health: ServicesHealth;
  isRefreshing: boolean;
  /** A última consulta falhou: `health` é a última informação recebida, não a atual. */
  stale?: boolean;
}

/**
 * Resumo do estado geral. Não é região viva: a StatusPage anuncia as mudanças em uma
 * única região, para que o leitor de tela não ouça a mesma notícia duas vezes.
 */
export function OverallStatus({ health, isRefreshing, stale = false }: OverallStatusProps) {
  const status = stale ? STALE_OVERALL_STATUS : presentServiceStatus(health.status);

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <StatusPill status={status.tone} label={status.label} />
        <p className="font-semibold text-ink">{overallSummary(health.status, stale)}</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        {isRefreshing && <Spinner size="sm" className="text-petroleo-600" />}
        <span>
          {stale ? 'Últimos dados recebidos:' : 'Última verificação:'}{' '}
          <span className="tabular-nums">{formatDateTime(health.checkedAt)}</span>
        </span>
      </div>
    </Card>
  );
}

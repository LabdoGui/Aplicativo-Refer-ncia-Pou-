import { PageHeader, QueryState } from '@/components/ui';
import { useDashboard } from '@/features/insights/api';
import { DashboardCards } from '@/features/insights/DashboardCards';
import { DashboardCharts } from '@/features/insights/DashboardCharts';
import { StatsFilterBar } from '@/features/insights/StatsFilterBar';
import { UnavailableAlert } from '@/features/insights/UnavailableAlert';
import { useStatsFilters } from '@/features/insights/use-stats-filters';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Visão geral da operação no período escolhido (dados fictícios). */
export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const state = useStatsFilters();
  const dashboard = useDashboard(state.filters);
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Doadores, agendamentos, doações, estoque e engajamento no período."
      />
      <StatsFilterBar state={state} />
      <QueryState
        isLoading={dashboard.isLoading}
        error={dashboard.error}
        onRetry={() => dashboard.refetch()}
        loadingLabel="Carregando indicadores…"
      >
        {dashboard.data && (
          <div
            className={cn(
              'space-y-6 transition-opacity',
              dashboard.isPlaceholderData && 'opacity-60',
            )}
            aria-busy={dashboard.isFetching}
          >
            <UnavailableAlert services={dashboard.data.unavailable} />
            <DashboardCards stats={dashboard.data} />
            <DashboardCharts stats={dashboard.data} />
          </div>
        )}
      </QueryState>
    </>
  );
}

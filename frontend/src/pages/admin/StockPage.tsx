import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  BLOOD_TYPE_LABELS,
  MOVEMENT_TYPE_LABELS,
  type MovementView,
  type StockItemView,
} from '@pulso/contracts';
import { Alert, Button, PageHeader, QueryState, StatCard } from '@/components/ui';
import { useStockOverview } from '@/features/inventory/api';
import { MovementDialog } from '@/features/inventory/MovementDialog';
import { MovementsTable } from '@/features/inventory/MovementsTable';
import { bags } from '@/features/inventory/stock-presentation';
import { StockHistoryChart } from '@/features/inventory/StockHistoryChart';
import { StockTicker } from '@/features/inventory/StockTicker';
import { ThresholdsDialog } from '@/features/inventory/ThresholdsDialog';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Banco de Sangue: níveis por tipo, tendência, histórico e movimentações (estoque central, D6). */
export function StockPage() {
  useDocumentTitle('Banco de Sangue');
  const overview = useStockOverview();
  const [movementOpen, setMovementOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<StockItemView | null>(null);
  const [saved, setSaved] = useState<MovementView | null>(null);

  return (
    <>
      <PageHeader
        title="Banco de Sangue"
        description="Estoque central por tipo sanguíneo (dados fictícios). Atualizado a cada movimentação."
        actions={
          <Button onClick={() => setMovementOpen(true)}>
            <Plus aria-hidden="true" className="size-4" /> Registrar movimentação
          </Button>
        }
      />
      <div aria-live="polite" className="mb-4">
        {saved && (
          <Alert tone="ok" role="status">
            {MOVEMENT_TYPE_LABELS[saved.type]} de {bags(saved.quantity)} do tipo{' '}
            {BLOOD_TYPE_LABELS[saved.bloodType]} registrada.{' '}
            {/* Movimentação retroativa: o saldo devolvido é o da data informada. */}
            {Date.parse(saved.createdAt) - Date.parse(saved.occurredAt) > 60_000
              ? `Saldo na data informada: ${bags(saved.balanceAfter)}.`
              : `Saldo atual: ${bags(saved.balanceAfter)}.`}
          </Alert>
        )}
      </div>
      <QueryState
        isLoading={overview.isLoading}
        error={overview.error}
        onRetry={() => overview.refetch()}
        loadingLabel="Carregando o estoque…"
      >
        {overview.data && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total em estoque"
                value={formatNumber(overview.data.totals.quantity)}
                hint="bolsas, todos os tipos"
              />
              <StatCard
                label="Tipos críticos"
                value={overview.data.totals.critical}
                hint="abaixo do mínimo"
              />
              <StatCard
                label="Tipos em atenção"
                value={overview.data.totals.attention}
                hint="entre o mínimo e o ideal"
              />
              <StatCard
                label="Tipos adequados"
                value={overview.data.totals.normal}
                hint={`atualizado em ${formatDateTime(overview.data.updatedAt)}`}
              />
            </div>
            <section aria-labelledby="niveis">
              <h2 id="niveis" className="mb-4 text-lg font-bold text-ink">
                Níveis por tipo
              </h2>
              <StockTicker items={overview.data.items} onAdjust={setAdjusting} />
            </section>
            <section aria-labelledby="historico">
              <h2 id="historico" className="mb-4 text-lg font-bold text-ink">
                Histórico
              </h2>
              <StockHistoryChart />
            </section>
            <section aria-labelledby="movimentacoes">
              <h2 id="movimentacoes" className="mb-4 text-lg font-bold text-ink">
                Movimentações
              </h2>
              <MovementsTable />
            </section>
          </div>
        )}
      </QueryState>
      <MovementDialog
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        onSaved={(movement) => {
          setSaved(movement);
          setMovementOpen(false);
        }}
      />
      <ThresholdsDialog item={adjusting} onClose={() => setAdjusting(null)} />
    </>
  );
}

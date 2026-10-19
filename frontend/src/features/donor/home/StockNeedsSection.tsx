import { BLOOD_TYPE_LABELS, STOCK_STATUS_LABELS, type PublicStockLevel } from '@pulso/contracts';
import { Card, StatusPill } from '@/components/ui';
import { usePublicStock } from '@/features/donor/api';

const PRIORITY: Record<PublicStockLevel['status'], number> = {
  CRITICAL: 0,
  ATTENTION: 1,
  NORMAL: 2,
};

/** Tipos sanguíneos em nível crítico ou de atenção no estoque (fictício). */
export function StockNeedsSection() {
  const stock = usePublicStock();
  if (stock.isLoading) return null;

  const needs = (stock.data ?? [])
    .filter((level) => level.status !== 'NORMAL')
    .sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status]);

  return (
    <Card as="section" aria-labelledby="estoque">
      <h2 id="estoque" className="text-lg font-bold text-ink">
        Tipos que mais precisam hoje
      </h2>
      {stock.error ? (
        <p className="mt-2 text-sm text-ink-muted">
          O nível do estoque está indisponível no momento.
        </p>
      ) : needs.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Todos os tipos estão em nível adequado hoje.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {needs.map((level) => (
            <li
              key={level.bloodType}
              className="flex items-center justify-between gap-2 rounded-control bg-canvas px-3 py-2.5"
            >
              <span className="font-display text-lg font-bold text-ink">
                {BLOOD_TYPE_LABELS[level.bloodType]}
              </span>
              <StatusPill
                size="sm"
                status={level.status === 'CRITICAL' ? 'critical' : 'warn'}
                label={STOCK_STATUS_LABELS[level.status]}
              />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Dados fictícios, para demonstração. Todos os tipos ajudam: seu tipo é confirmado na doação.
      </p>
    </Card>
  );
}

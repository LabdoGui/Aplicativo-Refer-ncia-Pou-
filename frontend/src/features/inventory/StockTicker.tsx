import { Minus, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import { BLOOD_TYPE_LABELS, STOCK_STATUS_LABELS, type StockItemView } from '@pulso/contracts';
import { Button, StatusPill } from '@/components/ui';
import { Sparkline } from '@/features/insights/charts/Sparkline';
import { formatNumber } from '@/lib/format';
import { bags, STOCK_TONE } from './stock-presentation';

const TREND_ICON = { UP: TrendingUp, DOWN: TrendingDown, STABLE: Minus } as const;
const TREND_TEXT = { UP: 'subiu', DOWN: 'caiu', STABLE: 'estável' } as const;

function trendText(item: StockItemView): string {
  const { delta7d, deltaPercent7d, direction } = item.trend;
  if (direction === 'STABLE') return 'Estável em 7 dias';
  const sign = delta7d > 0 ? '+' : '−';
  const percent =
    deltaPercent7d === null
      ? ''
      : ` (${sign}${formatNumber(Math.abs(deltaPercent7d), { maximumFractionDigits: 0 })}%)`;
  return `${sign}${Math.abs(delta7d)}${percent} em 7 dias`;
}

/** "Bolsa de valores" do estoque: um cartão por tipo, com nível, tendência e minigráfico de 14 dias. */
export function StockTicker({
  items,
  onAdjust,
}: {
  items: StockItemView[];
  onAdjust: (item: StockItemView) => void;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = TREND_ICON[item.trend.direction];
        const label = BLOOD_TYPE_LABELS[item.bloodType];
        return (
          <li
            key={item.bloodType}
            className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-3xl font-bold text-ink" aria-label={`Tipo ${label}`}>
                {label}
              </h3>
              <StatusPill
                status={STOCK_TONE[item.status]}
                label={STOCK_STATUS_LABELS[item.status]}
                size="sm"
              />
            </div>
            <p className="mt-3 text-2xl font-semibold text-ink tabular-nums">
              {bags(item.quantity)}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>
                <span className="sr-only">Tendência: {TREND_TEXT[item.trend.direction]}. </span>
                {trendText(item)}
              </span>
            </p>
            <div className="mt-3">
              <Sparkline values={item.sparkline} width={200} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
              <span>
                Mín. {item.minimum} · Ideal {item.ideal}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAdjust(item)}
                aria-label={`Ajustar níveis do tipo ${label}`}
              >
                <SlidersHorizontal aria-hidden="true" className="size-4" /> Níveis
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

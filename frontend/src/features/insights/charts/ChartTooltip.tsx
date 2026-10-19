import { formatNumber } from '@/lib/format';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
  /** Rótulo do eixo X formatado (ex.: data por extenso). */
  formatLabel?: (label: string) => string;
  unit?: string;
}

/** Tooltip: o valor em destaque e a categoria/data em segundo plano. */
export function ChartTooltip({ active, payload, label, formatLabel, unit }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value ?? 0);
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-sm shadow-raised">
      <p className="font-semibold text-ink tabular-nums">
        {formatNumber(value)}
        {unit ? ` ${unit}` : ''}
      </p>
      <p className="text-xs text-ink-muted">{formatLabel ? formatLabel(String(label)) : label}</p>
    </div>
  );
}

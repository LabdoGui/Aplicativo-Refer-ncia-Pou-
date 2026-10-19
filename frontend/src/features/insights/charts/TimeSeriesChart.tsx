import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate, formatLongDate } from '@/lib/format';
import { ChartTooltip } from './ChartTooltip';
import { axisProps, CHART, compactNumber } from './chart-theme';

export interface TimePoint {
  date: string;
  value: number;
}

/** Série temporal de uma medida: linha de 2 px com área suave e crosshair. */
export function TimeSeriesChart({
  points,
  unit,
  height = 240,
}: {
  points: TimePoint[];
  unit?: string;
  height?: number;
}) {
  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">Sem dados no período.</p>;
  }
  const short = (value: string) => formatDate(value).slice(0, 5);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={short} minTickGap={24} />
        <YAxis
          {...axisProps}
          axisLine={false}
          tickFormatter={compactNumber}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
          content={<ChartTooltip unit={unit} formatLabel={formatLongDate} />}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART.series}
          strokeWidth={2}
          fill={CHART.seriesWash}
          activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2, fill: CHART.series }}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

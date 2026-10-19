import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/format';
import { ChartTooltip } from './ChartTooltip';
import { axisProps, CHART, compactNumber } from './chart-theme';
import type { ChartRow } from './ChartCard';

/** Barras horizontais de uma série (categorias com nomes longos cabem no eixo). */
export function CategoryBarChart({ rows, unit }: { rows: ChartRow[]; unit?: string }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">Sem dados no período.</p>;
  }
  const height = Math.max(120, rows.length * 40 + 24);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" {...axisProps} tickFormatter={compactNumber} allowDecimals={false} />
        <YAxis type="category" dataKey="label" {...axisProps} axisLine={false} width={150} />
        <Tooltip cursor={{ fill: CHART.seriesWash }} content={<ChartTooltip unit={unit} />} />
        <Bar
          dataKey="value"
          fill={CHART.series}
          barSize={CHART.barSize}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            position="right"
            formatter={(value: number) => formatNumber(value)}
            fill={CHART.axis}
            fontSize={CHART.font}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

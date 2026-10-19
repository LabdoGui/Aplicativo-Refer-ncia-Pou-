/** Tokens dos gráficos (docs/12): série em petróleo, grade e eixos recessivos. */
export const CHART = {
  series: '#1a607a', // petróleo-600, contraste ~7:1 com a superfície
  seriesWash: 'rgba(26, 96, 122, 0.1)',
  grid: '#e6dfd8', // line
  axis: '#57606a', // ink-muted
  barSize: 24,
  font: 12,
} as const;

export const axisProps = {
  stroke: CHART.grid,
  tick: { fill: CHART.axis, fontSize: CHART.font },
  tickLine: false,
} as const;

/** Números compactos no eixo: 1.200 → 1,2 mil. */
export const compactNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

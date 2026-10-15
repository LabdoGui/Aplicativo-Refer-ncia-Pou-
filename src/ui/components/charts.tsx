import { useMemo, useRef, useState, type PointerEvent } from 'react';

/** Linha de série única com eixo Y, grade discreta e cursor com tooltip. */
export function LineChart({
  values,
  height = 180,
  format,
  xLabel,
  color,
  ariaLabel,
}: {
  values: number[];
  height?: number;
  format: (v: number) => string;
  xLabel: (index: number) => string;
  color?: string;
  ariaLabel: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const padL = 4;
  const padR = 64;
  const padT = 10;
  const padB = 20;
  const { min, max, path, area, ticks } = useMemo(() => {
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min *= 0.99;
      max *= 1.01;
      if (min === max) max = min + 1;
    }
    const span = max - min;
    min -= span * 0.08;
    max += span * 0.08;
    const n = Math.max(1, values.length - 1);
    const x = (i: number) => padL + ((W - padL - padR) * i) / n;
    const y = (v: number) => padT + (height - padT - padB) * (1 - (v - min) / (max - min));
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const path = `M${pts.join('L')}`;
    const area = `${path}L${x(values.length - 1).toFixed(1)},${height - padB}L${x(0).toFixed(1)},${height - padB}Z`;
    const ticks = [0, 0.5, 1].map((f) => min + (max - min) * (0.1 + 0.8 * f));
    return { min, max, path, area, ticks };
  }, [values, height]);

  if (values.length < 2) return <div className="empty">Coletando dados do mercado…</div>;

  const n = values.length - 1;
  const xOf = (i: number) => padL + ((W - padL - padR) * i) / n;
  const yOf = (v: number) => padT + (height - padT - padB) * (1 - (v - min) / (max - min));
  const up = values[values.length - 1] >= values[0];
  const stroke = color ?? (up ? 'var(--green)' : 'var(--red)');

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / (W - padL - padR)) * n);
    setHover(Math.max(0, Math.min(n, i)));
  };

  return (
    <div className="chart">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: 'pan-y' }}
      >
        <defs>
          <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={W - padR} y1={yOf(t)} y2={yOf(t)} strokeDasharray="2 4" />
            <text className="axis-label num" x={W - padR + 6} y={yOf(t) + 3}>
              {format(t)}
            </text>
          </g>
        ))}
        <text className="axis-label" x={padL} y={height - 4}>
          {xLabel(0)}
        </text>
        <text className="axis-label" x={W - padR} y={height - 4} textAnchor="end">
          {xLabel(n)}
        </text>
        <path d={area} fill="url(#lc-fill)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <g>
            <line x1={xOf(hover)} x2={xOf(hover)} y1={padT} y2={height - padB} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={xOf(hover)} cy={yOf(values[hover])} r={4.5} fill={stroke} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip num" style={{ left: `${(xOf(hover) / W) * 100}%` }}>
          <strong>{format(values[hover])}</strong> <span className="muted">· {xLabel(hover)}</span>
        </div>
      )}
    </div>
  );
}

/** Mini gráfico de tendência (sem eixos), para listas. */
export function Sparkline({ values, width = 80, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(2 + (height - 4) * (1 - (v - min) / span)).toFixed(1)}`)
    .join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={up ? 'var(--green)' : 'var(--red)'} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

/** Barras de fluxo de caixa líquido por período: verde = sobrou dinheiro, vermelho = faltou. */
export function FlowBars({
  values,
  labels,
  format,
  height = 120,
}: {
  values: number[];
  labels: string[];
  format: (v: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!values.length) return <div className="empty">O primeiro período de fluxo de caixa fecha em até 1 minuto.</div>;
  const W = 600;
  const maxAbs = Math.max(1, ...values.map(Math.abs));
  const hasNeg = values.some((v) => v < 0);
  const zeroY = hasNeg ? height / 2 : height - 4;
  const scale = (hasNeg ? height / 2 - 6 : height - 10) / maxAbs;
  const slot = W / values.length;
  const bw = Math.max(2, Math.min(28, slot - 2));
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Fluxo de caixa líquido por minuto" onPointerLeave={() => setHover(null)}>
        <line className="grid-line" x1={0} x2={W} y1={zeroY} y2={zeroY} />
        {values.map((v, i) => {
          const h = Math.max(1, Math.abs(v) * scale);
          const x = i * slot + (slot - bw) / 2;
          const y = v >= 0 ? zeroY - h : zeroY;
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
              <rect x={x} y={y} width={bw} height={h} rx={Math.min(4, bw / 2)} fill={v >= 0 ? 'var(--green)' : 'var(--red)'} opacity={hover === null || hover === i ? 1 : 0.45} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tip num" style={{ left: `${(((hover + 0.5) * slot) / W) * 100}%` }}>
          <strong className={values[hover] >= 0 ? 'pos' : 'neg'}>{format(values[hover])}</strong> <span className="muted">· {labels[hover]}</span>
        </div>
      )}
    </div>
  );
}

export interface StackPart {
  label: string;
  value: number;
  color: string;
  display: string;
}

/** Composição do patrimônio: barra empilhada + legenda com valores (identidade nunca só por cor). */
export function StackBar({ parts }: { parts: StackPart[] }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  return (
    <div>
      <div className="stackbar" role="img" aria-label="Composição do patrimônio">
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => <div key={p.label} title={`${p.label}: ${p.display}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <div key={p.label} className="row small">
            <span className="swatch" style={{ background: p.color }} />
            <span className="grow">{p.label}</span>
            <span className="num muted">{total > 0 ? `${((Math.max(0, p.value) / total) * 100).toFixed(1).replace('.', ',')}%` : '—'}</span>
            <span className="num" style={{ minWidth: 110, textAlign: 'right' }}>
              {p.display}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

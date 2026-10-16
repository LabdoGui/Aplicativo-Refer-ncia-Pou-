import { CircleCheck, CircleDashed, OctagonX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StatusTone = 'ok' | 'warn' | 'critical' | 'unknown';

interface ToneConfig {
  icon: LucideIcon;
  label: string;
  className: string;
}

// Cada estado tem cor + ícone de forma diferente + texto: nunca só a cor (WCAG 1.4.1).
const TONES: Record<StatusTone, ToneConfig> = {
  ok: { icon: CircleCheck, label: 'Adequado', className: 'bg-ok-soft text-ok-strong' },
  warn: { icon: TriangleAlert, label: 'Atenção', className: 'bg-warn-soft text-warn-strong' },
  critical: {
    icon: OctagonX,
    label: 'Crítico',
    className: 'bg-critical-soft text-critical-strong',
  },
  unknown: { icon: CircleDashed, label: 'Sem dados', className: 'bg-surface-muted text-ink-muted' },
};

interface StatusPillProps {
  status: StatusTone;
  /** Texto exibido; o padrão é o rótulo do estado ("Adequado", "Atenção", "Crítico"). */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusPill({ status, label, size = 'md', className }: StatusPillProps) {
  const { icon: Icon, label: defaultLabel, className: toneClass } = TONES[status];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        toneClass,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={size === 'sm' ? 'size-3.5' : 'size-4'}
        strokeWidth={2.25}
      />
      {label ?? defaultLabel}
    </span>
  );
}

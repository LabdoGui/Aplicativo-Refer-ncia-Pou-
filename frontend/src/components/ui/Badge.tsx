import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'brand' | 'info' | 'ok' | 'warn' | 'critical';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  brand: 'bg-carmim-50 text-carmim-800',
  info: 'bg-petroleo-50 text-petroleo-800',
  ok: 'bg-ok-soft text-ok-strong',
  warn: 'bg-warn-soft text-warn-strong',
  critical: 'bg-critical-soft text-critical-strong',
};

interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Rótulo curto e informativo. Para estado (ok/atenção/crítico) prefira o StatusPill. */
export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none font-semibold',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

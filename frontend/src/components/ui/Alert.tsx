import type { ReactNode } from 'react';
import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'ok' | 'warn' | 'critical';

const TONES: Record<AlertTone, { icon: LucideIcon; box: string; iconClass: string }> = {
  info: { icon: Info, box: 'border-petroleo-200 bg-petroleo-50', iconClass: 'text-petroleo-700' },
  ok: { icon: CircleCheck, box: 'border-ok/25 bg-ok-soft', iconClass: 'text-ok-strong' },
  warn: { icon: TriangleAlert, box: 'border-warn/25 bg-warn-soft', iconClass: 'text-warn-strong' },
  critical: {
    icon: OctagonAlert,
    box: 'border-critical/25 bg-critical-soft',
    iconClass: 'text-critical-strong',
  },
};

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  /** Ações opcionais (ex.: botão "Tentar novamente"). */
  actions?: ReactNode;
  /** Use "alert" para erros que surgem dinamicamente e precisam ser anunciados. */
  role?: 'alert' | 'status';
  className?: string;
}

export function Alert({ tone = 'info', title, children, actions, role, className }: AlertProps) {
  const { icon: Icon, box, iconClass } = TONES[tone];
  return (
    <div role={role} className={cn('flex gap-3 rounded-card border p-4 text-ink', box, className)}>
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-5 shrink-0', iconClass)}
        strokeWidth={2}
      />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm leading-relaxed text-ink">{children}</div>}
        {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
      </div>
    </div>
  );
}

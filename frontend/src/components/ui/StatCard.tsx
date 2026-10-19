import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Linha de contexto abaixo do número (ex.: "no período"). */
  hint?: ReactNode;
  className?: string;
}

/** Indicador numérico do painel. Mostra "—" quando o dado não está disponível. */
export function StatCard({ label, value, icon: Icon, hint, className }: StatCardProps) {
  return (
    <div className={cn('rounded-card border border-line bg-surface p-5 shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
            <Icon aria-hidden="true" className="size-5" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-ink tabular-nums">{value ?? '—'}</p>
      {hint && <div className="mt-1 text-sm text-ink-muted">{hint}</div>}
    </div>
  );
}

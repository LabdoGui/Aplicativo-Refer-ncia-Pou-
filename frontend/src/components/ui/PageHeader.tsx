import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  /** Linha curta acima do título (contexto da página). */
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-sm font-semibold tracking-wide text-petroleo-700 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {description && <div className="mt-2 text-base text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

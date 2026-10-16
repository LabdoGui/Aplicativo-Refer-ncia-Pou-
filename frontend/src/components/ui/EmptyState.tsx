import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Nível do título, para manter a hierarquia correta da página. */
  headingLevel?: 1 | 2 | 3;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  headingLevel = 2,
  children,
  className,
}: EmptyStateProps) {
  const Heading = (['h1', 'h2', 'h3'] as const)[headingLevel - 1];
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
        <Icon aria-hidden="true" className="size-7" strokeWidth={1.75} />
      </span>
      <Heading className="mt-4 text-xl font-bold text-ink">{title}</Heading>
      {description && <div className="mt-2 max-w-md text-ink-muted">{description}</div>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

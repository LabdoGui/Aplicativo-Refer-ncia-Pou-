import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label: string;
  /** Texto de ajuda abaixo do campo. */
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Recebe os ids para ligar rótulo, ajuda e erro ao controle (acessibilidade). */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Rótulo + controle + ajuda + erro, com aria-describedby e aria-invalid corretos. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="text-critical-strong" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-critical-strong">
          {error}
        </p>
      )}
    </div>
  );
}

export const controlStyles = (invalid: boolean, className?: string) =>
  cn(
    'block min-h-11 w-full rounded-control border bg-surface px-3 py-2 text-base text-ink',
    'placeholder:text-ink-muted/70 disabled:cursor-not-allowed disabled:bg-surface-muted',
    invalid ? 'border-critical' : 'border-line-strong/60 hover:border-line-strong',
    className,
  );

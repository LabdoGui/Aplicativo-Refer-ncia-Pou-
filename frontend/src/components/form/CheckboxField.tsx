import { useId, type ComponentProps, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';

interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'id' | 'type'> {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Caixa de seleção com área de toque de 44 px e erro ligado ao controle. */
export function CheckboxField({
  label,
  description,
  error,
  className,
  ref,
  ...props
}: CheckboxFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-desc` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center -m-2.5">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
            aria-invalid={error ? true : undefined}
            className="size-5 rounded border-line-strong accent-petroleo-700"
            {...props}
          />
        </span>
        <div className="min-w-0 pt-px">
          <label htmlFor={id} className="text-sm font-medium text-ink">
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="text-sm text-ink-muted">
              {description}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} className="pl-8 text-sm font-medium text-critical-strong">
          {error}
        </p>
      )}
    </div>
  );
}

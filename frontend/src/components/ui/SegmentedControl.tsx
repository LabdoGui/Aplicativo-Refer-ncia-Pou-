import { cn } from '@/lib/cn';

interface SegmentedControlProps<T extends string> {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

/** Grupo de botões de alternância (filtros curtos). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap rounded-control border border-line bg-surface p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-10 rounded-[0.5rem] px-3 text-sm font-semibold',
            value === option.value ? 'bg-petroleo-700 text-white' : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

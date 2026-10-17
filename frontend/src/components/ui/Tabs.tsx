import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  content: ReactNode;
}

interface TabsProps<T extends string> {
  label: string;
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
}

/** Abas acessíveis (WAI-ARIA): setas, Home/End e foco no painel. */
export function Tabs<T extends string>({ label, items, value, onChange }: TabsProps<T>) {
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = items.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {items.map((item, index) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                '-mb-px min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold whitespace-nowrap',
                selected
                  ? 'border-petroleo-700 text-petroleo-800'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) =>
        item.value === value ? (
          <div
            key={item.value}
            role="tabpanel"
            id={`${baseId}-panel-${item.value}`}
            aria-labelledby={`${baseId}-tab-${item.value}`}
            tabIndex={0}
            className="pt-6 focus-visible:outline-none"
          >
            {item.content}
          </div>
        ) : null,
      )}
    </div>
  );
}

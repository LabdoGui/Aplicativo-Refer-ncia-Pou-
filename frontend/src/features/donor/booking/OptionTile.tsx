import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface OptionTileProps {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  /** Nome acessível completo (ex.: "Segunda-feira, 19 de outubro, lotado"). */
  ariaLabel: string;
  onSelect: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Opção compacta de um grupo de rádio (dia, horário): o rádio nativo fica oculto
 * visualmente, mas segue operável por teclado (setas) e com foco visível no bloco.
 */
export function OptionTile({
  name,
  value,
  checked,
  disabled = false,
  ariaLabel,
  onSelect,
  children,
  className,
}: OptionTileProps) {
  return (
    <label
      className={cn(
        'flex min-h-14 flex-col items-center justify-center rounded-control border px-2 py-2 text-center transition-colors',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-petroleo-600',
        disabled
          ? 'cursor-not-allowed border-dashed border-line bg-surface-muted text-ink-muted'
          : checked
            ? 'cursor-pointer border-petroleo-700 bg-petroleo-700 text-white'
            : 'cursor-pointer border-line-strong/40 bg-surface text-ink hover:border-petroleo-400 hover:bg-petroleo-50',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {children}
    </label>
  );
}

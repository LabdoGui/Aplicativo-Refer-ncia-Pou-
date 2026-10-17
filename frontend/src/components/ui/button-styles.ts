import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

// Todas as alturas respeitam o alvo de toque mínimo de 44 px (WCAG 2.5.5 / docs/12).
// aria-disabled (botão carregando) tem a mesma aparência de disabled, mas segue focável.
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap ' +
  'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-60 ' +
  'aria-disabled:pointer-events-none aria-disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  // Carmim: só para a ação principal da tela.
  primary: 'bg-carmim-700 text-white shadow-card hover:bg-carmim-800 active:bg-carmim-900',
  secondary: 'bg-petroleo-700 text-white shadow-card hover:bg-petroleo-800 active:bg-petroleo-900',
  outline:
    'border border-petroleo-700 bg-surface text-petroleo-700 hover:bg-petroleo-50 active:bg-petroleo-100',
  ghost: 'text-petroleo-800 hover:bg-surface-muted active:bg-line',
  danger: 'bg-critical text-white shadow-card hover:bg-critical-strong',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-[0.9375rem]',
  lg: 'min-h-12 px-6 text-base',
};

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className);
}

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type CardVariant = 'raised' | 'muted';

const VARIANTS: Record<CardVariant, string> = {
  // Branco com sombra suave sobre o fundo linho (padrão).
  raised: 'bg-surface shadow-card',
  // Linho sem sombra, para cards dentro de faixas brancas.
  muted: 'bg-canvas',
};

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li';
  variant?: CardVariant;
  /** Aplica o espaçamento interno padrão (desative para conteúdo de borda a borda). */
  padded?: boolean;
}

export function Card({
  as = 'div',
  variant = 'raised',
  padded = true,
  className,
  ...props
}: CardProps) {
  const Component = as;
  return (
    <Component
      className={cn(
        'rounded-card border border-line',
        VARIANTS[variant],
        padded && 'p-5 sm:p-6',
        className,
      )}
      {...props}
    />
  );
}

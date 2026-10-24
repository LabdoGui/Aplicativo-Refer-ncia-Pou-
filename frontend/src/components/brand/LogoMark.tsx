import { cn } from '@/lib/cn';
import { SYMBOL_DROP_PATH, SYMBOL_FIGURES_PATH, SYMBOL_VIEWBOX } from './symbol-paths';

export type LogoTone = 'brand' | 'white';

interface LogoMarkProps {
  className?: string;
}

/**
 * Símbolo do SangueConecta: gota vermelha com duas pessoas cujos braços formam
 * um coração (docs/marca). Sempre nas cores da marca, que funcionam em fundo
 * claro e escuro. Decorativo: o nome acessível fica no texto ou no link.
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox={SYMBOL_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      className={cn('h-8 w-auto shrink-0', className)}
    >
      <path d={SYMBOL_DROP_PATH} className="fill-marca-vermelho" />
      <path d={SYMBOL_FIGURES_PATH} className="fill-marca-claro" />
    </svg>
  );
}

import { cn } from '@/lib/cn';
import {
  SYMBOL_DROP_PATH,
  SYMBOL_FIGURES_PATH,
  SYMBOL_VIEWBOX,
} from '@/components/brand/symbol-paths';

/**
 * Ilustração decorativa do hero: o símbolo do SangueConecta ampliado, no centro de
 * círculos concêntricos. Sem dados, números ou pessoas fictícias.
 */
export function HeroArt({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative aspect-[10/9] overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-card',
        className,
      )}
    >
      <svg viewBox="0 0 400 360" preserveAspectRatio="xMidYMid slice" className="size-full">
        <g fill="none" className="text-petroleo-100" stroke="currentColor" strokeWidth="1.5">
          <circle cx="200" cy="190" r="168" />
          <circle cx="200" cy="190" r="124" />
        </g>
        <circle cx="200" cy="190" r="84" className="fill-petroleo-50" />

        {/* Símbolo da marca (mesma geometria do LogoMark), centrado nos círculos. */}
        <svg x="138" y="95" width="124" height="190" viewBox={SYMBOL_VIEWBOX}>
          <path d={SYMBOL_DROP_PATH} className="fill-marca-vermelho" />
          <path d={SYMBOL_FIGURES_PATH} className="fill-marca-claro" />
        </svg>

        <g className="fill-coral">
          <circle cx="291" cy="144.5" r="7" />
          <circle cx="330" cy="292" r="4" opacity="0.6" />
          <circle cx="72" cy="104" r="5" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

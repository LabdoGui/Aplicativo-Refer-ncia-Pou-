import { cn } from '@/lib/cn';

/**
 * Ilustração decorativa do hero: o símbolo do Pulso ampliado, com a linha de pulso
 * atravessando o painel. Sem dados, números ou pessoas fictícias.
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

        {/* Gota (geometria do LogoMark ampliada 7×). */}
        <path
          d="M200 102.5c-19.25 23.8-59.5 70.7-59.5 106.75a59.5 59.5 0 0 0 119 0c0-36.05-40.25-82.95-59.5-106.75z"
          className="fill-surface text-carmim-700"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinejoin="round"
        />

        {/* Linha de pulso que atravessa a base da gota e sobe para a direita. */}
        <path
          d="M-10 225H154.5L172 191.75L194.75 244.25L215.75 200.5L410 56"
          fill="none"
          className="text-petroleo-700"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <g className="fill-coral">
          <circle cx="291" cy="144.5" r="7" />
          <circle cx="330" cy="292" r="4" opacity="0.6" />
          <circle cx="72" cy="104" r="5" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

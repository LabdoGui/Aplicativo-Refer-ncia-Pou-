import { cn } from '@/lib/cn';

export type LogoTone = 'brand' | 'white';

interface LogoMarkProps {
  tone?: LogoTone;
  className?: string;
}

/**
 * Símbolo do Pulso (docs/12, item 14.6): gota de traço contínuo cuja base é
 * atravessada por uma linha de pulso que sobe para a direita e sai da gota.
 * Decorativo: o nome acessível fica no texto ou no link que o contém.
 */
export function LogoMark({ tone = 'brand', className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', tone === 'brand' ? 'text-carmim-700' : 'text-white', className)}
    >
      <g stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3.5c-2.75 3.4-8.5 10.1-8.5 15.25a8.5 8.5 0 0 0 17 0C24.5 13.6 18.75 6.9 16 3.5z" />
        <path d="M3 21h6.5l2.5-4.75 3.25 7.5 3-6.25L29 9.5" />
      </g>
    </svg>
  );
}

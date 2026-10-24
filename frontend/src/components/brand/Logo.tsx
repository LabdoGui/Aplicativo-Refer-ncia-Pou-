import { cn } from '@/lib/cn';
import { LogoMark, type LogoTone } from './LogoMark';

interface LogoProps {
  tone?: LogoTone;
  size?: 'sm' | 'md';
  /** Em telas com menos de 360 px, mostra só o símbolo (cabeçalhos do celular). */
  collapsible?: boolean;
  className?: string;
}

/**
 * Logotipo horizontal: símbolo + "SangueConecta", com "Sangue" em vermelho e
 * "Conecta" em azul, como na arte da marca. Em fundo escuro, o nome fica branco.
 * No celular o nome fica menor, para caber no cabeçalho ao lado das ações.
 */
export function Logo({ tone = 'brand', size = 'md', collapsible = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 sm:gap-2', className)}>
      <LogoMark className={size === 'sm' ? 'h-7' : 'h-7 sm:h-8'} />
      <span
        className={cn(
          'font-display leading-none font-extrabold tracking-[-0.01em]',
          size === 'sm' ? 'text-base sm:text-lg' : 'text-base sm:text-[1.375rem]',
          collapsible && 'max-[22.5rem]:hidden',
        )}
      >
        <span className={tone === 'brand' ? 'text-marca-vermelho' : 'text-white'}>Sangue</span>
        <span className={tone === 'brand' ? 'text-marca-azul' : 'text-white'}>Conecta</span>
      </span>
    </span>
  );
}

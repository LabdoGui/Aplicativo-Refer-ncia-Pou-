import { cn } from '@/lib/cn';
import { LogoMark, type LogoTone } from './LogoMark';

interface LogoProps {
  tone?: LogoTone;
  size?: 'sm' | 'md';
  className?: string;
}

/** Logotipo horizontal: símbolo + "pulso" em minúsculas (Plus Jakarta Sans Bold). */
export function Logo({ tone = 'brand', size = 'md', className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark tone={tone} className={size === 'sm' ? 'size-7' : 'size-8'} />
      <span
        className={cn(
          'font-display leading-none font-bold tracking-[0.03em]',
          size === 'sm' ? 'text-lg' : 'text-[1.375rem]',
          tone === 'brand' ? 'text-ink' : 'text-white',
        )}
      >
        pulso
      </span>
    </span>
  );
}

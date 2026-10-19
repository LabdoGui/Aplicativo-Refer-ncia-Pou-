import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PublicContainerProps {
  /** "narrow" para textos longos (melhor comprimento de linha). */
  size?: 'wide' | 'narrow';
  children: ReactNode;
}

/** Margens e largura máxima das páginas públicas. */
export function PublicContainer({ size = 'wide', children }: PublicContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto px-4 py-10 sm:px-6 lg:py-14',
        size === 'wide' ? 'max-w-page' : 'max-w-3xl',
      )}
    >
      {children}
    </div>
  );
}

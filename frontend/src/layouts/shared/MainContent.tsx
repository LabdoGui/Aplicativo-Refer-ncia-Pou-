import type { ReactNode } from 'react';
import { MAIN_CONTENT_ID } from '@/components/ui';
import { cn } from '@/lib/cn';

/** <main> padrão dos layouts: alvo do skip link (recebe foco por programação). */
export function MainContent({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className={cn('flex-1', className)}>
      {children}
    </main>
  );
}

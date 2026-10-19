import { useEffect, useRef, type ReactNode } from 'react';
import { Card } from '@/components/ui';

interface StepShellProps {
  title: string;
  description?: ReactNode;
  /** Move o foco para o título ao abrir a etapa (troca de etapa). */
  autoFocus: boolean;
  children: ReactNode;
  /** Botões de navegação no rodapé. */
  footer?: ReactNode;
}

/** Moldura de uma etapa: título focável (anunciado na troca), conteúdo e rodapé. */
export function StepShell({ title, description, autoFocus, children, footer }: StepShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (autoFocus) headingRef.current?.focus();
  }, [autoFocus]);

  return (
    <Card as="section" aria-labelledby="etapa-agendamento">
      <h2
        id="etapa-agendamento"
        ref={headingRef}
        tabIndex={-1}
        className="scroll-mt-44 text-xl font-bold text-ink sm:text-2xl"
      >
        {title}
      </h2>
      {description && <div className="mt-1 text-ink-muted">{description}</div>}
      <div className="mt-5">{children}</div>
      {footer && (
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
          {footer}
        </div>
      )}
    </Card>
  );
}

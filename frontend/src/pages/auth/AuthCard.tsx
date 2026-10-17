import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

/** Moldura das telas de entrar e criar conta. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description && <div className="mt-2 text-ink-muted">{description}</div>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
    </div>
  );
}

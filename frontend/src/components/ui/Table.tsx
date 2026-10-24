import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Tabela responsiva: rola na horizontal dentro do cartão em telas estreitas
 * (a página nunca ganha rolagem lateral). Use `caption` para o nome acessível.
 */
export function Table({
  caption,
  children,
  className,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    // relative: rótulos só para leitor de tela (sr-only, posição absoluta) ficam presos à
    // rolagem horizontal em vez de alargar a página no celular.
    <div
      className={cn(
        'relative overflow-x-auto rounded-card border border-line bg-surface',
        className,
      )}
    >
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-canvas text-xs tracking-wide text-ink-muted uppercase">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('align-middle', className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('px-4 py-3 font-semibold whitespace-nowrap', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 text-ink', className)} {...props} />;
}

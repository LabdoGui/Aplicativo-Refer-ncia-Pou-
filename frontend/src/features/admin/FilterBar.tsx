import type { ReactNode } from 'react';

/** Linha de filtros acima do conteúdo que eles afetam. */
export function FilterBar({
  children,
  label = 'Filtros',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="mb-6 flex flex-wrap items-end gap-4 rounded-card border border-line bg-surface p-4"
    >
      {children}
    </div>
  );
}

import type { ReactNode } from 'react';
import { Card, Table, TBody, Td, Th, THead, Tr } from '@/components/ui';
import { formatNumber } from '@/lib/format';

export interface ChartRow {
  label: string;
  value: number;
}

interface ChartCardProps {
  title: string;
  /** Leitura em texto do gráfico (para quem não enxerga o desenho). */
  summary: string;
  rows: ChartRow[];
  columns: [string, string];
  children: ReactNode;
  className?: string;
}

/** Cartão de gráfico: título, resumo em texto, o desenho e a tabela com os dados. */
export function ChartCard({ title, summary, rows, columns, children, className }: ChartCardProps) {
  return (
    <Card as="section" className={className} aria-label={title}>
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{summary}</p>
      <div className="mt-4" aria-hidden="true">
        {children}
      </div>
      {rows.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer py-2 font-semibold text-petroleo-700">
            Ver tabela
          </summary>
          <Table caption={title} className="mt-2">
            <THead>
              <Tr>
                <Th>{columns[0]}</Th>
                <Th className="text-right">{columns[1]}</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.label}>
                  <Td>{row.label}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(row.value)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </details>
      )}
    </Card>
  );
}

import type { PointsEntryView } from '@pulso/contracts';
import { Card } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';

/** Últimos lançamentos de pontos (descrição, data e quantidade). */
export function RecentPoints({ entries }: { entries: PointsEntryView[] }) {
  return (
    <Card as="section" aria-labelledby="ultimos-pontos">
      <h2 id="ultimos-pontos" className="text-lg font-bold text-ink">
        Últimos pontos
      </h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          Você ainda não recebeu pontos. Eles aparecem aqui depois do seu primeiro comparecimento
          para doar.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-ink">{entry.description}</p>
                <p className="text-sm text-ink-muted">{formatDate(entry.createdAt)}</p>
              </div>
              <span className="shrink-0 font-display text-lg font-bold text-ink tabular-nums">
                +{formatNumber(entry.points)}
                <span className="ml-1 font-sans text-sm font-medium text-ink-muted">pts</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

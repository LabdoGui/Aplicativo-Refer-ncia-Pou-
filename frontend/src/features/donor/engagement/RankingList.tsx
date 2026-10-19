import type { RankingEntry } from '@pulso/contracts';
import { Badge, Card, QueryState } from '@/components/ui';
import { useRanking } from '@/features/donor/api';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

/** Os 10 primeiros do ranking (empates dividem a posição) e a posição de quem consulta. */
export function RankingList() {
  const ranking = useRanking(true);
  const data = ranking.data;
  const meOutsideTop = data?.me && !data.entries.some((entry) => entry.isMe) ? data.me : null;

  return (
    <Card padded={false} className="overflow-hidden">
      <h3 className="px-5 pt-5 font-sans text-base font-semibold text-ink sm:px-6">10 primeiros</h3>
      <div className="px-5 pb-5 sm:px-6">
        <QueryState
          isLoading={ranking.isLoading}
          error={ranking.error}
          onRetry={() => ranking.refetch()}
          loadingLabel="Carregando ranking…"
        >
          {data && data.entries.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Ainda não há participantes no ranking.</p>
          ) : (
            <ol className="-mx-5 mt-3 divide-y divide-line border-y border-line sm:-mx-6">
              {data?.entries.map((entry, index) => (
                <RankingRow key={`${entry.position}-${entry.nickname}-${index}`} entry={entry} />
              ))}
            </ol>
          )}
          {meOutsideTop && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-ink-muted">Sua posição</p>
              <ul className="-mx-5 mt-2 border-y border-line sm:-mx-6">
                <RankingRow entry={meOutsideTop} />
              </ul>
            </div>
          )}
        </QueryState>
      </div>
    </Card>
  );
}

function RankingRow({ entry }: { entry: RankingEntry }) {
  return (
    <li className={cn('flex items-center gap-3 px-5 py-3 sm:px-6', entry.isMe && 'bg-petroleo-50')}>
      <span className="w-9 shrink-0 font-display text-lg font-bold text-ink tabular-nums">
        {entry.position}º
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          <span className="min-w-0 break-words">{entry.nickname}</span>
          {entry.isMe && <Badge tone="info">Você</Badge>}
        </p>
        <p className="text-sm text-ink-muted">{entry.levelName}</p>
      </div>
      <span className="shrink-0 font-semibold text-ink tabular-nums">
        {formatNumber(entry.points)} <span className="text-sm font-medium text-ink-muted">pts</span>
      </span>
    </li>
  );
}

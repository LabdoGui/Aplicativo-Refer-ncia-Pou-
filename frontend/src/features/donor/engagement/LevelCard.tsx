import { Check } from 'lucide-react';
import { LEVELS, type GamificationProfile } from '@pulso/contracts';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

/** Nível atual, total de pontos e progresso (medidor acessível) até o próximo nível. */
export function LevelCard({ profile }: { profile: GamificationProfile }) {
  const { level, nextLevel, totalPoints } = profile;
  const span = nextLevel ? nextLevel.minPoints - level.minPoints : 1;
  const percent = nextLevel
    ? Math.min(100, Math.max(0, ((totalPoints - level.minPoints) / span) * 100))
    : 100;

  return (
    <Card as="section" aria-labelledby="seu-nivel">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h2 id="seu-nivel" className="font-sans text-sm font-medium text-ink-muted">
            Seu nível
          </h2>
          <p className="font-display text-3xl font-bold text-ink">{level.name}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm font-medium text-ink-muted">Total de pontos</p>
          <p className="font-display text-3xl font-bold text-ink tabular-nums">
            {formatNumber(totalPoints)}
          </p>
        </div>
      </div>

      {nextLevel ? (
        <div className="mt-6">
          <div className="flex flex-wrap justify-between gap-x-4 text-sm">
            <span id="progresso-nivel" className="font-semibold text-ink">
              Rumo a {nextLevel.name}
            </span>
            <span className="text-ink-muted tabular-nums">
              {formatNumber(totalPoints)} de {formatNumber(nextLevel.minPoints)} pontos
            </span>
          </div>
          <div
            role="meter"
            aria-labelledby="progresso-nivel"
            aria-valuemin={level.minPoints}
            aria-valuemax={nextLevel.minPoints}
            aria-valuenow={totalPoints}
            aria-valuetext={`${totalPoints} de ${nextLevel.minPoints} pontos`}
            className="mt-2 h-3 overflow-hidden rounded-full bg-surface-muted"
          >
            <div className="h-full rounded-full bg-petroleo-700" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Faltam {formatNumber(nextLevel.pointsToGo)} pontos para o próximo nível.
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink">Você chegou ao nível mais alto do Pulso.</p>
      )}

      <ol aria-label="Níveis" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEVELS.map((item) => {
          const current = item.code === level.code;
          const reached = totalPoints >= item.minPoints;
          return (
            <li
              key={item.code}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'rounded-control border px-3 py-2 text-sm',
                current ? 'border-petroleo-700 bg-petroleo-50' : 'border-line',
              )}
            >
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                {reached && <Check aria-hidden="true" className="size-4 text-petroleo-700" />}
                {item.name}
                {reached && !current && <span className="sr-only"> (alcançado)</span>}
              </span>
              <span className="block text-xs text-ink-muted">
                {current ? 'Seu nível · ' : ''}
                {item.minPoints === 0 ? 'início' : `${formatNumber(item.minPoints)} pts`}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-ink-muted">Comparecimentos</dt>
          <dd className="font-display text-xl font-bold text-ink tabular-nums">
            {formatNumber(profile.attendanceCount)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Doações concluídas</dt>
          <dd className="font-display text-xl font-bold text-ink tabular-nums">
            {formatNumber(profile.donationCount)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

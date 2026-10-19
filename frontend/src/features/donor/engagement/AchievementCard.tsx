import { CircleCheck, Lock, Medal } from 'lucide-react';
import type { AchievementView } from '@pulso/contracts';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

/** Conquista desbloqueada (com data) ou bloqueada (com progresso atual/meta). */
export function AchievementCard({ achievement }: { achievement: AchievementView }) {
  const { unlocked, progress } = achievement;
  const percent = Math.min(100, (progress.current / Math.max(1, progress.target)) * 100);
  return (
    <li
      className={cn(
        'flex gap-4 rounded-card border p-4 sm:p-5',
        unlocked ? 'border-line bg-surface shadow-card' : 'border-dashed border-line bg-canvas',
      )}
    >
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-full',
          unlocked ? 'bg-petroleo-700 text-white' : 'bg-surface-muted text-ink-muted',
        )}
      >
        {unlocked ? (
          <Medal aria-hidden="true" className="size-5" />
        ) : (
          <Lock aria-hidden="true" className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-sans text-base font-semibold text-ink">{achievement.name}</h3>
        <p className="mt-0.5 text-sm text-ink-muted">{achievement.description}</p>
        {unlocked ? (
          <Badge
            tone="ok"
            className="mt-3"
            icon={<CircleCheck aria-hidden="true" className="size-3.5" strokeWidth={2.25} />}
          >
            {achievement.unlockedAt
              ? `Conquistada em ${formatDate(achievement.unlockedAt)}`
              : 'Conquistada'}
          </Badge>
        ) : (
          <div className="mt-3">
            <p className="text-xs font-semibold text-ink-muted">
              <span className="sr-only">Bloqueada. </span>Progresso: {progress.current} de{' '}
              {progress.target}
            </p>
            <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-petroleo-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

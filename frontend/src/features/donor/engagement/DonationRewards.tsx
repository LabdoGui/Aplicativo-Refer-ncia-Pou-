import { Medal, Sparkles } from 'lucide-react';
import type { DonorAttendanceView, GamificationProfile } from '@pulso/contracts';
import { Button, Card, Spinner } from '@/components/ui';
import { isNearAttendance } from '@/features/donor/history/format';
import { formatNumber } from '@/lib/format';
import { useGamificationProfileUntil } from './use-profile-until';

const pointsNear = (profile: GamificationProfile, attendedAt: string) =>
  profile.recentPoints.filter((entry) => isNearAttendance(entry.createdAt, attendedAt));

/**
 * Pontos e conquistas desta doação. Como chegam por eventos, a tela espera alguns
 * segundos ("processando") e consulta de novo antes de mostrar o resultado.
 */
export function DonationRewards({ attendance }: { attendance: DonorAttendanceView }) {
  const { query, processing, timedOut } = useGamificationProfileUntil(
    (profile) => pointsNear(profile, attendance.attendedAt).length > 0,
    true,
  );
  const profile = query.data;

  return (
    <Card as="section" aria-labelledby="seus-pontos">
      <h2 id="seus-pontos" className="text-lg font-bold text-ink">
        Seus pontos
      </h2>
      <div aria-live="polite" className="mt-4">
        {query.isLoading || processing ? (
          <p className="flex items-start gap-3 text-sm text-ink-muted">
            <Spinner className="mt-0.5" />
            Estamos registrando seus pontos e conquistas. Isso leva alguns segundos.
          </p>
        ) : query.error || !profile ? (
          <div className="space-y-2 text-sm text-ink-muted">
            <p>Não foi possível carregar seus pontos agora.</p>
            <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <RewardsSummary profile={profile} attendedAt={attendance.attendedAt} late={timedOut} />
        )}
      </div>
    </Card>
  );
}

function RewardsSummary({
  profile,
  attendedAt,
  late,
}: {
  profile: GamificationProfile;
  attendedAt: string;
  late: boolean;
}) {
  const earned = pointsNear(profile, attendedAt);
  const unlocked = profile.achievements.filter(
    (achievement) => achievement.unlocked && isNearAttendance(achievement.unlockedAt, attendedAt),
  );

  return (
    <div className="space-y-5">
      {earned.length > 0 ? (
        <ul className="space-y-2">
          {earned.map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-3">
              <span className="text-ink">{entry.description}</span>
              <span className="shrink-0 font-display text-lg font-bold text-ink tabular-nums">
                +{formatNumber(entry.points)}
                <span className="ml-1 font-sans text-sm font-medium text-ink-muted">pts</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          {late
            ? 'Seus pontos ainda estão sendo processados. Eles aparecem em Conquistas em instantes.'
            : 'Nenhum ponto lançado para esta doação.'}
        </p>
      )}

      {unlocked.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-ink">
            <Sparkles aria-hidden="true" className="size-4 text-petroleo-700" />
            {unlocked.length === 1 ? 'Conquista desbloqueada' : 'Conquistas desbloqueadas'}
          </h3>
          <ul className="mt-2 space-y-2">
            {unlocked.map((achievement) => (
              <li key={achievement.code} className="flex gap-3 rounded-control bg-canvas p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-petroleo-700 text-white">
                  <Medal aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-ink">{achievement.name}</p>
                  <p className="text-sm text-ink-muted">{achievement.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-line pt-4 text-sm">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-ink-muted">Nível atual</dt>
            <dd className="font-semibold text-ink">{profile.level.name}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Total de pontos</dt>
            <dd className="font-semibold text-ink tabular-nums">
              {formatNumber(profile.totalPoints)}
            </dd>
          </div>
        </dl>
        {profile.nextLevel && (
          <p className="mt-3 text-ink-muted">
            Faltam {formatNumber(profile.nextLevel.pointsToGo)} pontos para {profile.nextLevel.name}
            .
          </p>
        )}
      </div>
    </div>
  );
}

import { PageHeader, QueryState } from '@/components/ui';
import { useGamificationProfile } from '@/features/donor/api';
import { AchievementCard } from '@/features/donor/engagement/AchievementCard';
import { LevelCard } from '@/features/donor/engagement/LevelCard';
import { PointsBasisNote } from '@/features/donor/engagement/PointsBasisNote';
import { RankingSection } from '@/features/donor/engagement/RankingSection';
import { RecentPoints } from '@/features/donor/engagement/RecentPoints';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Conquistas: pontos, nível, conquistas, últimos lançamentos e o ranking opcional. */
export function AchievementsPage() {
  useDocumentTitle('Conquistas');
  const profile = useGamificationProfile();
  const data = profile.data;
  const unlocked = data?.achievements.filter((achievement) => achievement.unlocked).length ?? 0;

  return (
    <>
      <PageHeader
        title="Conquistas"
        description="Acompanhe seus pontos, seu nível e as conquistas da sua jornada como doador."
      />
      <QueryState
        isLoading={profile.isLoading}
        error={profile.error}
        onRetry={() => profile.refetch()}
        loadingLabel="Carregando suas conquistas…"
      >
        {data && (
          <div className="space-y-8">
            <LevelCard profile={data} />
            <PointsBasisNote basis={data.pointsBasis} />
            <section aria-labelledby="suas-conquistas">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 id="suas-conquistas" className="text-lg font-bold text-ink">
                  Suas conquistas
                </h2>
                <p className="text-sm text-ink-muted">
                  {unlocked} de {data.achievements.length} desbloqueadas
                </p>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.achievements.map((achievement) => (
                  <AchievementCard key={achievement.code} achievement={achievement} />
                ))}
              </ul>
            </section>
            <RecentPoints entries={data.recentPoints} />
            {data.ranking.enabled && <RankingSection profile={data} />}
          </div>
        )}
      </QueryState>
    </>
  );
}

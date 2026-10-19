import { ShieldCheck } from 'lucide-react';
import type { GamificationProfile } from '@pulso/contracts';
import { Badge } from '@/components/ui';
import { RankingList } from './RankingList';
import { RankingParticipation } from './RankingParticipation';

/** Ranking opcional (RN20): só apelido, nível e pontos; nunca dados de saúde. */
export function RankingSection({ profile }: { profile: GamificationProfile }) {
  return (
    <section aria-labelledby="ranking" className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="ranking" className="text-lg font-bold text-ink">
            Ranking
          </h2>
          <Badge>Opcional</Badge>
        </div>
        <p className="mt-1 flex gap-2 text-sm text-ink-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-petroleo-700" />
          No ranking aparecem só o seu apelido, o nível e os pontos. Nunca seu nome, e-mail ou dados
          de saúde.
        </p>
      </div>
      <RankingParticipation ranking={profile.ranking} />
      <RankingList />
    </section>
  );
}

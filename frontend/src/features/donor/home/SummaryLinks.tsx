import type { ReactNode } from 'react';
import { ClipboardList, Droplet, Trophy } from 'lucide-react';
import { PRE_SCREENING_RESULT_LABELS, type GamificationProfile } from '@pulso/contracts';
import {
  useEligibility,
  useGamificationProfile,
  useLatestPreScreening,
} from '@/features/donor/api';
import { RESULT_PRESENTATION } from '@/features/donor/prescreening/result-presentation';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber } from '@/lib/format';
import { SummaryFallback, SummaryLink } from './SummaryLink';

/** Linha de resumo: pontos e nível, última doação e pré-triagem. */
export function SummaryLinks() {
  return (
    <section aria-labelledby="resumo">
      <h2 id="resumo" className="sr-only">
        Resumo
      </h2>
      <ul className="grid gap-3 md:grid-cols-3">
        <PointsSummary />
        <LastDonationSummary />
        <PreScreeningSummary />
      </ul>
    </section>
  );
}

function PointsSummary() {
  const profile = useGamificationProfile();
  return (
    <SummaryLink to="/app/conquistas" icon={Trophy} title="Pontos e nível">
      {profile.data ? (
        <PointsContent profile={profile.data} />
      ) : (
        <SummaryFallback isLoading={profile.isLoading} />
      )}
    </SummaryLink>
  );
}

function PointsContent({ profile }: { profile: GamificationProfile }) {
  const { totalPoints, level, nextLevel } = profile;
  const span = nextLevel ? nextLevel.minPoints - level.minPoints : 0;
  const percent = nextLevel && span > 0 ? ((totalPoints - level.minPoints) / span) * 100 : 100;
  return (
    <>
      <p>
        <span className="font-display text-xl font-bold tabular-nums">
          {formatNumber(totalPoints)}
        </span>{' '}
        <span className="text-sm text-ink-muted">{totalPoints === 1 ? 'ponto' : 'pontos'}</span>
        <span className="text-sm text-ink-muted"> · Nível {level.name}</span>
      </p>
      {nextLevel ? (
        <>
          <div
            role="meter"
            aria-label={`Progresso até o nível ${nextLevel.name}`}
            aria-valuemin={level.minPoints}
            aria-valuemax={nextLevel.minPoints}
            aria-valuenow={totalPoints}
            aria-valuetext={`${totalPoints} de ${nextLevel.minPoints} pontos`}
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              className="h-full rounded-full bg-petroleo-600"
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            Faltam {formatNumber(nextLevel.pointsToGo)} para {nextLevel.name}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-ink-muted">Você chegou ao nível mais alto.</p>
      )}
    </>
  );
}

function LastDonationSummary() {
  const eligibility = useEligibility();
  const last = eligibility.data?.lastDonationAt;
  return (
    <SummaryLink to="/app/doacoes" icon={Droplet} title="Última doação">
      {eligibility.data ? (
        <>
          <p className="font-display text-xl font-bold">
            {last ? formatDate(last) : 'Nenhuma ainda'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {last ? 'Veja seu histórico e documentos' : 'Seu histórico aparece aqui'}
          </p>
        </>
      ) : (
        <SummaryFallback isLoading={eligibility.isLoading} />
      )}
    </SummaryLink>
  );
}

function PreScreeningSummary() {
  const latest = useLatestPreScreening();
  const data = latest.data;
  let content: ReactNode;
  if (latest.isLoading || latest.error) {
    content = <SummaryFallback isLoading={latest.isLoading} />;
  } else if (!data) {
    content = (
      <>
        <p className="font-semibold">Não respondida</p>
        <p className="mt-1 text-xs text-ink-muted">Opcional, ajuda a se preparar</p>
      </>
    );
  } else if (data.expired) {
    content = (
      <>
        <p className="font-semibold">Vencida</p>
        <p className="mt-1 text-xs text-ink-muted">
          Valeu até {formatDate(data.expiresAt)}. Responda de novo.
        </p>
      </>
    );
  } else {
    const { icon: Icon, text } = RESULT_PRESENTATION[data.result];
    content = (
      <>
        <p className="flex items-start gap-1.5 font-semibold">
          <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', text)} />
          {PRE_SCREENING_RESULT_LABELS[data.result]}
        </p>
        <p className="mt-1 text-xs text-ink-muted">Válida até {formatDate(data.expiresAt)}</p>
      </>
    );
  }
  return (
    <SummaryLink to="/app/pre-triagem" icon={ClipboardList} title="Pré-triagem">
      {content}
    </SummaryLink>
  );
}

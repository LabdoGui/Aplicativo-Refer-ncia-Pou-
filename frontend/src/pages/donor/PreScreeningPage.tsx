import { useState, type ReactNode } from 'react';
import { PRE_SCREENING_DISCLAIMER, type PreScreeningResultView } from '@pulso/contracts';
import { Alert, PageHeader, Spinner } from '@/components/ui';
import { useLatestPreScreening } from '@/features/donor/api';
import { PreScreeningResultCard } from '@/features/donor/prescreening/PreScreeningResultCard';
import { QuestionnaireSection } from '@/features/donor/prescreening/QuestionnaireSection';
import { isPreScreeningValid } from '@/features/donor/prescreening/result-presentation';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

type View =
  { kind: 'auto' } | { kind: 'wizard' } | { kind: 'result'; result: PreScreeningResultView };

/** Pré-triagem informativa: último resultado válido ou questionário em etapas. */
export function PreScreeningPage() {
  useDocumentTitle('Pré-triagem');
  const latest = useLatestPreScreening();
  const [view, setView] = useState<View>({ kind: 'auto' });
  const restart = () => setView({ kind: 'wizard' });

  let content: ReactNode;
  if (view.kind === 'result') {
    content = (
      <PreScreeningResultCard
        result={view.result}
        eyebrow="Seu resultado"
        onRestart={restart}
        focusOnMount
      />
    );
  } else if (view.kind === 'auto' && latest.isLoading) {
    content = <Spinner label="Carregando sua pré-triagem…" className="py-10 text-ink-muted" />;
  } else if (view.kind === 'auto' && isPreScreeningValid(latest.data)) {
    content = (
      <PreScreeningResultCard
        result={latest.data}
        eyebrow="Sua pré-triagem mais recente"
        onRestart={restart}
      />
    );
  } else {
    const expired = view.kind === 'auto' && latest.data?.expired ? latest.data : null;
    content = (
      <div className="space-y-6">
        <Alert tone="info" title="Avaliação informativa">
          {PRE_SCREENING_DISCLAIMER}
        </Alert>
        {expired && (
          <p className="text-sm text-ink-muted">
            Sua última pré-triagem valeu até {formatDate(expired.expiresAt)}. Responda de novo para
            atualizar as orientações.
          </p>
        )}
        <QuestionnaireSection
          focusOnMount={view.kind === 'wizard'}
          onSubmitted={(result) => setView({ kind: 'result', result })}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Pré-triagem"
        description="Perguntas rápidas para orientar você antes da doação. Não impede o agendamento."
      />
      {content}
    </>
  );
}

import type { PreScreeningResultView } from '@pulso/contracts';
import { Button, ButtonLink, Spinner } from '@/components/ui';
import { useQuestionnaire } from '@/features/donor/api';
import { errorCode, ProblemAlert } from '@/components/ui/ProblemAlert';
import { PreScreeningWizard } from './PreScreeningWizard';

interface QuestionnaireSectionProps {
  onSubmitted: (result: PreScreeningResultView) => void;
  focusOnMount: boolean;
}

/** Carrega o questionário vigente. Se a pré-triagem estiver fora, o agendamento segue livre. */
export function QuestionnaireSection({ onSubmitted, focusOnMount }: QuestionnaireSectionProps) {
  const questionnaire = useQuestionnaire();

  if (questionnaire.isLoading) {
    return <Spinner label="Carregando o questionário…" className="py-10 text-ink-muted" />;
  }
  if (questionnaire.error || !questionnaire.data) {
    const unavailable = errorCode(questionnaire.error) === 'PRESCREENING_UNAVAILABLE';
    return (
      <ProblemAlert
        error={questionnaire.error}
        tone={unavailable ? 'warn' : 'critical'}
        title="Pré-triagem indisponível"
        actions={
          <>
            <ButtonLink to="/app/agendar" size="sm">
              Agendar doação
            </ButtonLink>
            {!unavailable && (
              <Button variant="outline" size="sm" onClick={() => questionnaire.refetch()}>
                Tentar novamente
              </Button>
            )}
          </>
        }
      />
    );
  }
  return (
    <PreScreeningWizard
      questionnaire={questionnaire.data}
      onSubmitted={onSubmitted}
      focusOnMount={focusOnMount}
    />
  );
}

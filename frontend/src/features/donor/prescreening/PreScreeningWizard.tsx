import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  VALIDATION_STATUS_LABELS,
  type PreScreeningQuestionnaire,
  type PreScreeningResultView,
} from '@pulso/contracts';
import { CheckboxField } from '@/components/form';
import { Button, ButtonLink, Card } from '@/components/ui';
import { useSubmitPreScreening } from '@/features/donor/api';
import { ProblemAlert } from '@/components/ui/ProblemAlert';
import { isApiError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { QuestionField } from './QuestionField';
import {
  answerErrorsFromApi,
  buildAnswers,
  pruneHidden,
  validateStep,
  visibleQuestions,
  wizardSteps,
  type Draft,
  type DraftValue,
  type QuestionErrors,
} from './questionnaire-logic';
import { StepProgress } from './StepProgress';

interface PreScreeningWizardProps {
  questionnaire: PreScreeningQuestionnaire;
  onSubmitted: (result: PreScreeningResultView) => void;
  /** Leva o foco ao título da etapa já na abertura (quando o doador pediu para responder). */
  focusOnMount?: boolean;
}

/** Questionário em etapas: valida cada etapa, mantém as respostas ao voltar. */
export function PreScreeningWizard({
  questionnaire,
  onSubmitted,
  focusOnMount = false,
}: PreScreeningWizardProps) {
  const steps = useMemo(() => wizardSteps(questionnaire), [questionnaire]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [errors, setErrors] = useState<QuestionErrors>({});
  const [share, setShare] = useState(false);
  const submit = useSubmitPreScreening();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const shouldFocusHeading = useRef(focusOnMount);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const visible = step ? visibleQuestions(step, questionnaire.questions, draft) : [];

  useEffect(() => {
    if (!shouldFocusHeading.current) return;
    headingRef.current?.focus();
  }, [index]);

  function goTo(nextIndex: number) {
    shouldFocusHeading.current = true;
    setErrors({});
    setIndex(nextIndex);
  }

  function setAnswer(code: string, value: DraftValue) {
    setDraft((current) => pruneHidden(questionnaire.questions, { ...current, [code]: value }));
    setErrors(({ [code]: _removed, ...rest }) => rest);
  }

  function focusFirstError(codes: string[]) {
    const first = visible.find((question) => codes.includes(question.code));
    if (!first) return;
    // Espera o React mostrar as mensagens antes de mover o foco.
    window.requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[data-question="${first.code}"] input`)
        ?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submit.isPending) return;
    const stepErrors = validateStep(visible, draft, todayIso());
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      focusFirstError(Object.keys(stepErrors));
      return;
    }
    if (!isLast) {
      goTo(index + 1);
      return;
    }
    try {
      const result = await submit.mutateAsync({
        answers: buildAnswers(questionnaire.questions, draft),
        shareWithStaff: share,
      });
      onSubmitted(result);
    } catch (error) {
      const fromApi = isApiError(error) ? answerErrorsFromApi(error.fieldErrors) : {};
      const codes = Object.keys(fromApi);
      if (codes.length === 0) return;
      // Volta para a primeira etapa com resposta a corrigir.
      const target = steps.findIndex((s) => s.questions.some((q) => codes.includes(q.code)));
      if (target >= 0 && target !== index) goTo(target);
      else focusFirstError(codes);
      setErrors(fromApi);
    }
  }

  if (!step) return null;
  const apiFieldErrors = isApiError(submit.error) && Object.keys(errors).length > 0;

  return (
    <Card as="section" aria-labelledby="etapa-titulo">
      <StepProgress current={index + 1} total={steps.length} />
      <h2
        id="etapa-titulo"
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 scroll-mt-40 text-xl font-bold text-ink sm:text-2xl"
      >
        <span className="sr-only">
          Etapa {index + 1} de {steps.length}:{' '}
        </span>
        {step.title}
      </h2>
      <p className="mt-1 text-ink-muted">{step.description}</p>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6">
        <div className="space-y-7">
          {visible.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={draft[question.code]}
              error={errors[question.code]}
              onChange={(value) => setAnswer(question.code, value)}
            />
          ))}
        </div>

        {isLast && (
          <div className="mt-8 rounded-card border border-line bg-canvas p-4">
            <CheckboxField
              label="Compartilhar minhas respostas com a equipe da unidade"
              description="Ajuda a equipe a se preparar para o seu atendimento. Sem isso, guardamos apenas o resultado informativo. Você pode revogar depois em Privacidade e dados."
              checked={share}
              onChange={(event) => setShare(event.target.checked)}
            />
          </div>
        )}

        {submit.error && !apiFieldErrors ? (
          <ProblemAlert
            error={submit.error}
            title="Não foi possível ver o resultado"
            className="mt-6"
            actions={
              <ButtonLink to="/app/agendar" variant="outline" size="sm">
                Agendar mesmo assim
              </ButtonLink>
            }
          />
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
          {index > 0 && (
            <Button variant="ghost" disabled={submit.isPending} onClick={() => goTo(index - 1)}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Voltar
            </Button>
          )}
          <Button
            type="submit"
            variant={isLast ? 'primary' : 'secondary'}
            size="lg"
            loading={submit.isPending}
            className="sm:ml-auto"
          >
            {isLast ? 'Ver resultado' : 'Próxima'}
            {!isLast && <ArrowRight aria-hidden="true" className="size-4" />}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-xs text-ink-muted">
        Questionário versão {questionnaire.ruleSetVersion} ·{' '}
        {VALIDATION_STATUS_LABELS[questionnaire.validationStatus]}.
        {questionnaire.normativeReference && ` ${questionnaire.normativeReference}`}
      </p>
    </Card>
  );
}

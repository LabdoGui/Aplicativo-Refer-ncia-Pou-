import { ClipboardCheck } from 'lucide-react';
import {
  PRE_SCREENING_RESULT_LABELS,
  type PreScreeningResult,
  type SharedPreScreeningView,
} from '@pulso/contracts';
import { Badge, type BadgeTone, Card, QueryState } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useSharedPreScreening } from './api';

const TONES: Record<PreScreeningResult, BadgeTone> = {
  FAVORABLE: 'ok',
  TALK_TO_UNIT: 'warn',
  WAIT_UNTIL: 'info',
};

/** Pré-triagem que o doador escolheu compartilhar (acesso registrado na auditoria). */
export function SharedPreScreeningPanel({ appointmentId }: { appointmentId: string }) {
  const query = useSharedPreScreening(appointmentId, true);
  return (
    <Card as="section" aria-labelledby="pre-triagem-titulo" className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck aria-hidden="true" className="size-5 text-petroleo-700" />
        <h2 id="pre-triagem-titulo" className="text-lg font-bold text-ink">
          Pré-triagem do doador
        </h2>
      </div>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data === null ? (
          <p className="text-sm text-ink-muted">
            Não há pré-triagem válida compartilhada pelo doador. A mais recente pode não ter sido
            compartilhada ou já estar fora da validade.
          </p>
        ) : (
          query.data && <SharedAnswers data={query.data} />
        )}
      </QueryState>
    </Card>
  );
}

function SharedAnswers({ data }: { data: SharedPreScreeningView }) {
  const steps = [...new Set(data.answers.map((answer) => answer.step))].sort((a, b) => a - b);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TONES[data.result]}>{PRE_SCREENING_RESULT_LABELS[data.result]}</Badge>
        <span className="text-sm text-ink-muted">
          Respondida em {formatDateTime(data.createdAt)} · válida até{' '}
          {formatDateTime(data.expiresAt)}
        </span>
      </div>
      <p className="text-sm text-ink-muted">
        Informativa: orienta a conversa, mas não substitui a triagem profissional.
      </p>
      {data.guidance.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {data.guidance.map((item, index) => (
            <li key={index}>{item.message}</li>
          ))}
        </ul>
      )}
      <div className="space-y-3">
        {steps.map((step) => (
          <dl key={step} className="rounded-card bg-canvas p-3 text-sm">
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Etapa {step}
            </p>
            {data.answers
              .filter((answer) => answer.step === step)
              .map((answer) => (
                <div key={answer.question} className="flex justify-between gap-4 py-1">
                  <dt className="text-ink">{answer.question}</dt>
                  <dd className="shrink-0 font-semibold text-ink">{answer.answer}</dd>
                </div>
              ))}
          </dl>
        ))}
      </div>
    </div>
  );
}

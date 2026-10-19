import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  PRE_SCREENING_DISCLAIMER,
  PRE_SCREENING_RESULT_LABELS,
  VALIDATION_STATUS_LABELS,
  type PreScreeningResultView,
} from '@pulso/contracts';
import { Alert, Button, ButtonLink, Card } from '@/components/ui';
import { activeAppointment, useMyAppointments } from '@/features/donor/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { GUIDANCE_ICON, RESULT_PRESENTATION } from './result-presentation';

interface PreScreeningResultCardProps {
  result: PreScreeningResultView;
  /** Título curto acima do resultado ("Seu resultado", "Sua pré-triagem mais recente"). */
  eyebrow: string;
  onRestart: () => void;
  /** Leva o foco ao título (resultado recém-calculado). */
  focusOnMount?: boolean;
}

/** Resultado informativo da pré-triagem (RN07): orienta, nunca bloqueia o agendamento. */
export function PreScreeningResultCard({
  result,
  eyebrow,
  onRestart,
  focusOnMount = false,
}: PreScreeningResultCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const appointments = useMyAppointments();
  const active = activeAppointment(appointments.data);
  const { icon: Icon, text, soft } = RESULT_PRESENTATION[result.result];

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <Card as="section" aria-labelledby="resultado-titulo" className="space-y-6">
      <div className="flex items-start gap-4">
        <span className={cn('grid size-12 shrink-0 place-items-center rounded-full', soft, text)}>
          <Icon aria-hidden="true" className="size-6" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-muted">{eyebrow}</p>
          <h2
            id="resultado-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {PRE_SCREENING_RESULT_LABELS[result.result]}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Respondida em {formatDate(result.createdAt)}
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-ink">Orientações</h3>
        {result.guidance.length === 0 ? (
          <p className="mt-2 text-ink">Suas respostas não indicaram pontos de atenção.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {result.guidance.map((item, position) => {
              const ItemIcon = GUIDANCE_ICON[item.severity];
              return (
                <li key={position} className="flex gap-3">
                  <ItemIcon
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-petroleo-700"
                  />
                  <span className="text-ink">{item.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <dl className="grid gap-4 rounded-card bg-canvas p-4 text-sm sm:grid-cols-2">
        {result.waitUntil && (
          <div>
            <dt className="text-ink-muted">Data informativa</dt>
            <dd className="font-semibold text-ink">{formatDate(result.waitUntil)}</dd>
          </div>
        )}
        <div>
          <dt className="text-ink-muted">{result.expired ? 'Venceu em' : 'Válida até'}</dt>
          <dd className="font-semibold text-ink">{formatDate(result.expiresAt)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Suas respostas</dt>
          <dd className="font-semibold text-ink">
            {result.sharedWithStaff ? (
              <>
                Compartilhadas com a equipe da unidade.{' '}
                <Link
                  to="/app/privacidade"
                  className="font-medium text-petroleo-700 underline underline-offset-2"
                >
                  Gerenciar
                </Link>
              </>
            ) : (
              'Não compartilhadas: guardamos só o resultado.'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Regras usadas</dt>
          <dd className="font-semibold text-ink">
            Versão {result.ruleSetVersion} · {VALIDATION_STATUS_LABELS[result.validationStatus]}
          </dd>
        </div>
      </dl>

      <Alert tone="info" title="Avaliação informativa">
        {PRE_SCREENING_DISCLAIMER}
      </Alert>

      <div className="flex flex-col gap-3 sm:flex-row">
        {active ? (
          <ButtonLink to={`/app/agendamentos/${active.id}`} size="lg">
            Ver meu agendamento
          </ButtonLink>
        ) : (
          <ButtonLink to="/app/agendar" size="lg">
            Agendar doação
          </ButtonLink>
        )}
        <Button variant="outline" size="lg" onClick={onRestart}>
          Responder novamente
        </Button>
      </div>
    </Card>
  );
}

import { CalendarClock, CalendarX2, CircleCheck, CircleX } from 'lucide-react';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  SCHEDULING_POLICY,
  type AppointmentView,
  type CancelledBy,
} from '@pulso/contracts';
import { Alert, Button, ButtonLink, Card } from '@/components/ui';
import { dateAtTime } from './format';
import { telHref } from './phone';

const CANCELLED_BY_LABEL: Record<CancelledBy, string> = {
  DONOR: 'por você',
  STAFF: 'pela unidade',
  SYSTEM: 'pelo sistema',
};

/** "Cancelado em 17/10/2026 às 10:00 por você. Motivo: …" */
function cancellationText(appointment: AppointmentView): string {
  const parts: string[] = [];
  if (appointment.cancelledAt) {
    const by = appointment.cancelledBy ? ` ${CANCELLED_BY_LABEL[appointment.cancelledBy]}` : '';
    parts.push(`Cancelado em ${dateAtTime(appointment.cancelledAt)}${by}.`);
  }
  if (appointment.cancelReason) {
    parts.push(`Motivo: ${appointment.cancelReason.replace(/\.+$/, '')}.`);
  }
  return parts.join(' ');
}

interface AppointmentStatusPanelProps {
  appointment: AppointmentView;
  /** Agendamento ativo atual do doador (para oferecer "Agendar" só quando faz sentido). */
  activeElsewhere?: AppointmentView;
  /** Novo agendamento criado a partir deste (reagendamento). */
  replacement?: AppointmentView;
  onCancel: () => void;
}

/** O que o doador pode fazer agora, conforme a situação do agendamento. */
export function AppointmentStatusPanel({
  appointment,
  activeElsewhere,
  replacement,
  onCancel,
}: AppointmentStatusPanelProps) {
  const { status, unit } = appointment;
  const bookAgain = !activeElsewhere && <ButtonLink to="/app/agendar">Agendar doação</ButtonLink>;

  if (appointment.canChange) {
    return (
      <Card as="section" aria-labelledby="alterar">
        <h2 id="alterar" className="text-lg font-bold text-ink">
          Precisa mudar algo?
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Você pode reagendar ou cancelar pelo app até {SCHEDULING_POLICY.cancelMinHours} horas
          antes do horário.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to={`/app/agendar?reagendar=${appointment.id}`} variant="outline">
            <CalendarClock aria-hidden="true" className="size-4" />
            Reagendar
          </ButtonLink>
          <Button variant="ghost" onClick={onCancel}>
            <CircleX aria-hidden="true" className="size-4" />
            Cancelar agendamento
          </Button>
        </div>
      </Card>
    );
  }

  if (status === 'CHECKED_IN') {
    return (
      <Alert tone="info" title="Check-in feito">
        Você já está registrado na unidade. A equipe conduz as próximas etapas do atendimento.
      </Alert>
    );
  }

  if (ACTIVE_APPOINTMENT_STATUSES.includes(status)) {
    return (
      <Alert tone="info" title="Alterações só com a unidade">
        Cancelamentos e reagendamentos pelo app vão até {SCHEDULING_POLICY.cancelMinHours} horas
        antes do horário.{' '}
        {unit.phone ? (
          <>
            Para mudar agora, ligue para a unidade:{' '}
            <a
              href={telHref(unit.phone)}
              className="font-semibold text-petroleo-700 underline underline-offset-2"
            >
              {unit.phone}
            </a>
            .
          </>
        ) : (
          'Para mudar agora, fale com a unidade.'
        )}
      </Alert>
    );
  }

  if (status === 'COMPLETED') {
    return (
      <Alert
        tone="ok"
        title="Atendimento concluído"
        actions={
          <ButtonLink to="/app/doacoes" variant="outline" size="sm">
            Ver minhas doações
          </ButtonLink>
        }
      >
        {appointment.completedAt ? `Finalizado em ${dateAtTime(appointment.completedAt)}. ` : ''}
        Obrigado por comparecer.
      </Alert>
    );
  }

  if (status === 'NO_SHOW') {
    return (
      <Card as="section" aria-labelledby="nao-compareceu" className="flex gap-3">
        <CalendarX2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warn-strong" />
        <div>
          <h2 id="nao-compareceu" className="font-bold text-ink">
            Comparecimento não registrado
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Quando quiser, escolha uma nova data para doar.
          </p>
          {bookAgain && <div className="mt-4">{bookAgain}</div>}
        </div>
      </Card>
    );
  }

  // Cancelado.
  return (
    <Card as="section" aria-labelledby="cancelado" className="flex gap-3">
      <CircleX aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-muted" />
      <div className="min-w-0">
        <h2 id="cancelado" className="font-bold text-ink">
          {replacement ? 'Substituído por um novo horário' : 'Sobre o cancelamento'}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {replacement && appointment.cancelledAt
            ? `Reagendado em ${dateAtTime(appointment.cancelledAt)}.`
            : cancellationText(appointment)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {replacement ? (
            <ButtonLink to={`/app/agendamentos/${replacement.id}`} variant="secondary">
              <CircleCheck aria-hidden="true" className="size-4" />
              Ver novo agendamento
            </ButtonLink>
          ) : (
            bookAgain
          )}
        </div>
      </div>
    </Card>
  );
}

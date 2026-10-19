import type { AppointmentView } from '@pulso/contracts';
import { ButtonLink, Card } from '@/components/ui';
import { AppointmentStatusBadge } from '@/features/scheduling/AppointmentStatusBadge';
import { AppointmentSummary } from './AppointmentSummary';

/** O doador já tem um agendamento ativo (RN03): mostra-o em vez de um novo agendamento. */
export function ActiveAppointmentNotice({ appointment }: { appointment: AppointmentView }) {
  return (
    <Card as="section" aria-labelledby="agendamento-ativo" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="agendamento-ativo" className="text-xl font-bold text-ink">
          Você já tem uma doação agendada
        </h2>
        <AppointmentStatusBadge status={appointment.status} />
      </div>
      <p className="text-ink-muted">
        É possível ter um agendamento ativo por vez. Para mudar a data, reagende o atual.
      </p>
      <AppointmentSummary appointment={appointment} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink to={`/app/agendamentos/${appointment.id}`} variant="secondary">
          Ver agendamento
        </ButtonLink>
        {appointment.canChange && (
          <ButtonLink to={`/app/agendar?reagendar=${appointment.id}`} variant="outline">
            Reagendar
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}

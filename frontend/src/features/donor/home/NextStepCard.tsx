import { CalendarPlus, ClipboardList } from 'lucide-react';
import type { AppointmentView } from '@pulso/contracts';
import { Alert, Button, ButtonLink, Card, Spinner } from '@/components/ui';
import {
  activeAppointment,
  useEligibility,
  useLatestPreScreening,
  useMyAppointments,
} from '@/features/donor/api';
import { AppointmentStatusBadge } from '@/features/scheduling/AppointmentStatusBadge';
import { AppointmentSummary } from '@/features/donor/booking/AppointmentSummary';
import { isPreScreeningValid } from '@/features/donor/prescreening/result-presentation';
import { EligibilityNote } from './EligibilityNote';

/** Bloco principal do início: o agendamento ativo ou o convite para agendar. */
export function NextStepCard() {
  const appointments = useMyAppointments();
  const eligibility = useEligibility();
  const active = activeAppointment(appointments.data);

  return (
    <Card as="section" aria-labelledby="proximo-passo" className="space-y-5">
      <p className="text-sm font-semibold tracking-wide text-petroleo-700 uppercase">
        Próximo passo
      </p>
      {appointments.isLoading ? (
        <>
          <h2 id="proximo-passo" className="sr-only">
            Próximo passo
          </h2>
          <Spinner label="Carregando seus agendamentos…" className="text-ink-muted" />
        </>
      ) : appointments.error ? (
        <>
          <h2 id="proximo-passo" className="text-xl font-bold text-ink">
            Seus agendamentos
          </h2>
          <Alert
            tone="critical"
            title="Não foi possível carregar seus agendamentos"
            actions={
              <Button variant="outline" size="sm" onClick={() => appointments.refetch()}>
                Tentar novamente
              </Button>
            }
          >
            Você ainda pode abrir a tela de agendamento pelo menu.
          </Alert>
        </>
      ) : active ? (
        <ActiveAppointment appointment={active} />
      ) : (
        <BookingInvite />
      )}
      <EligibilityNote eligibility={eligibility.data} />
    </Card>
  );
}

function ActiveAppointment({ appointment }: { appointment: AppointmentView }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="proximo-passo" className="text-xl font-bold text-ink sm:text-2xl">
          Sua doação está agendada
        </h2>
        <AppointmentStatusBadge status={appointment.status} />
      </div>
      <AppointmentSummary appointment={appointment} />
      <ButtonLink
        to={`/app/agendamentos/${appointment.id}`}
        variant="secondary"
        className="w-full sm:w-auto"
      >
        Ver agendamento
      </ButtonLink>
    </>
  );
}

function BookingInvite() {
  const latest = useLatestPreScreening();
  const suggestPreScreening = !latest.isLoading && !isPreScreeningValid(latest.data);
  return (
    <>
      <div>
        <h2 id="proximo-passo" className="text-xl font-bold text-ink sm:text-2xl">
          Agende sua próxima doação
        </h2>
        <p className="mt-1 text-ink-muted">
          Escolha a unidade, o dia e o horário que forem melhores para você.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/app/agendar" size="lg">
          <CalendarPlus aria-hidden="true" className="size-5" />
          Agendar doação
        </ButtonLink>
        {suggestPreScreening && (
          <ButtonLink to="/app/pre-triagem" variant="outline" size="lg">
            <ClipboardList aria-hidden="true" className="size-5" />
            Fazer pré-triagem
          </ButtonLink>
        )}
      </div>
    </>
  );
}

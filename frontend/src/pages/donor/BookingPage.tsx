import { CalendarSearch } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { SCHEDULING_POLICY } from '@pulso/contracts';
import { Alert, ButtonLink, EmptyState, PageHeader, QueryState } from '@/components/ui';
import { activeAppointment, useAppointment, useMyAppointments } from '@/features/donor/api';
import { ActiveAppointmentNotice } from '@/features/donor/booking/ActiveAppointmentNotice';
import { BookingFlow } from '@/features/donor/booking/BookingFlow';
import { isApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Agendar (ou reagendar, com ?reagendar=<id>) uma doação. */
export function BookingPage() {
  const [params] = useSearchParams();
  const rescheduleId = params.get('reagendar');
  const title = rescheduleId ? 'Reagendar doação' : 'Agendar doação';
  useDocumentTitle(title);

  return (
    <>
      <PageHeader
        title={title}
        description={
          rescheduleId
            ? 'Escolha a nova data. O horário atual é liberado quando você confirmar.'
            : 'Escolha a unidade, o dia e o horário que preferir.'
        }
        className="mb-6"
      />
      {rescheduleId ? (
        <RescheduleGate id={rescheduleId} />
      ) : (
        <NewBookingGate campaignParam={params.get('campanha')} />
      )}
    </>
  );
}

function NewBookingGate({ campaignParam }: { campaignParam: string | null }) {
  const appointments = useMyAppointments();
  const active = activeAppointment(appointments.data);
  return (
    <QueryState
      isLoading={appointments.isLoading}
      error={appointments.error}
      onRetry={() => appointments.refetch()}
      loadingLabel="Carregando seus agendamentos…"
    >
      {active ? (
        <ActiveAppointmentNotice appointment={active} />
      ) : (
        <BookingFlow campaignParam={campaignParam} />
      )}
    </QueryState>
  );
}

function RescheduleGate({ id }: { id: string }) {
  const appointment = useAppointment(id);
  const notFound = isApiError(appointment.error) && [400, 404].includes(appointment.error.status);

  if (notFound) {
    return (
      <EmptyState
        icon={CalendarSearch}
        title="Agendamento não encontrado"
        description="Confira o link ou abra o agendamento pela tela inicial."
      >
        <ButtonLink to="/app" variant="outline">
          Ir para o início
        </ButtonLink>
      </EmptyState>
    );
  }
  return (
    <QueryState
      isLoading={appointment.isLoading}
      error={appointment.error}
      onRetry={() => appointment.refetch()}
      loadingLabel="Carregando o agendamento…"
    >
      {appointment.data &&
        (appointment.data.canChange ? (
          <BookingFlow current={appointment.data} />
        ) : (
          <Alert
            tone="info"
            title="Este agendamento não pode ser reagendado pelo app"
            actions={
              <ButtonLink to={`/app/agendamentos/${id}`} variant="outline" size="sm">
                Ver agendamento
              </ButtonLink>
            }
          >
            Reagendamentos pelo app vão até {SCHEDULING_POLICY.cancelMinHours} horas antes do
            horário e só valem para agendamentos ativos. Em caso de dúvida, fale com a unidade.
          </Alert>
        ))}
    </QueryState>
  );
}

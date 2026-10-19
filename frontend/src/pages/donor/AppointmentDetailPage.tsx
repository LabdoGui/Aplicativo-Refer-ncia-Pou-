import { useEffect, useRef, useState } from 'react';
import { CalendarSearch, ClipboardList } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  SCHEDULING_POLICY,
  type AppointmentStatus,
  type AppointmentView,
} from '@pulso/contracts';
import { Alert, ButtonLink, Card, EmptyState, PageHeader, QueryState } from '@/components/ui';
import {
  activeAppointment,
  useAppointment,
  useLatestPreScreening,
  useMyAppointments,
} from '@/features/donor/api';
import { AppointmentDetailCard } from '@/features/donor/booking/AppointmentDetailCard';
import { AppointmentStatusPanel } from '@/features/donor/booking/AppointmentStatusPanel';
import { CancelAppointmentDialog } from '@/features/donor/booking/CancelAppointmentDialog';
import { LiveMessage } from '@/features/donor/booking/LiveMessage';
import { PreparationGuidance } from '@/features/donor/booking/PreparationGuidance';
import { isPreScreeningValid } from '@/features/donor/prescreening/result-presentation';
import { isApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/use-document-title';

const TITLES: Record<AppointmentStatus, string> = {
  BOOKED: 'Sua doação está agendada',
  CONFIRMED: 'Sua doação está agendada',
  CHECKED_IN: 'Atendimento em andamento',
  COMPLETED: 'Atendimento concluído',
  CANCELLED: 'Agendamento cancelado',
  NO_SHOW: 'Agendamento não realizado',
};

/** Detalhe de um agendamento do doador, com reagendar/cancelar dentro do prazo (RN06). */
export function AppointmentDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('novo') === '1';
  const rescheduled = params.get('reagendado') === '1';
  const appointment = useAppointment(id);
  useDocumentTitle(isNew ? 'Agendamento confirmado' : 'Agendamento');

  const notFound = isApiError(appointment.error) && [400, 404].includes(appointment.error.status);
  if (notFound) {
    return (
      <EmptyState
        icon={CalendarSearch}
        headingLevel={1}
        title="Agendamento não encontrado"
        description="Ele pode ter sido removido ou o link está incompleto."
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
      {appointment.data && (
        <AppointmentDetail
          appointment={appointment.data}
          isNew={isNew}
          rescheduled={rescheduled}
          onStale={() => void appointment.refetch()}
        />
      )}
    </QueryState>
  );
}

interface AppointmentDetailProps {
  appointment: AppointmentView;
  isNew: boolean;
  rescheduled: boolean;
  onStale: () => void;
}

function AppointmentDetail({ appointment, isNew, rescheduled, onStale }: AppointmentDetailProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);
  const cancelledRef = useRef<HTMLDivElement>(null);
  const appointments = useMyAppointments();
  const latest = useLatestPreScreening();
  const isActive = ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status);
  const activeElsewhere = activeAppointment(appointments.data);
  const replacement = appointments.data?.find((a) => a.rescheduledFromId === appointment.id);
  const suggestPreScreening =
    isActive &&
    appointment.status !== 'CHECKED_IN' &&
    latest.isSuccess &&
    !isPreScreeningValid(latest.data);

  // Depois do cancelamento, o botão que abriu o diálogo some: o foco vai para a confirmação.
  useEffect(() => {
    if (justCancelled) cancelledRef.current?.focus();
  }, [justCancelled]);

  return (
    <>
      <PageHeader
        eyebrow="Agendamento"
        title={replacement ? 'Agendamento reagendado' : TITLES[appointment.status]}
        className="mb-6"
      />

      {isNew && isActive && (
        <LiveMessage>
          <Alert
            tone="ok"
            title={rescheduled ? 'Reagendamento confirmado' : 'Agendamento confirmado'}
            className="mb-6"
          >
            Guarde o código <strong className="font-mono">{appointment.code}</strong>. Se precisar,
            você pode reagendar ou cancelar até {SCHEDULING_POLICY.cancelMinHours} horas antes.
          </Alert>
        </LiveMessage>
      )}
      {justCancelled && (
        <div ref={cancelledRef} tabIndex={-1} className="mb-6">
          <Alert tone="ok" role="status" title="Cancelamento confirmado">
            O horário foi liberado para outra pessoa. Quando quiser, agende uma nova data.
          </Alert>
        </div>
      )}

      <div className="space-y-6">
        <AppointmentDetailCard appointment={appointment} />
        <AppointmentStatusPanel
          appointment={appointment}
          activeElsewhere={activeElsewhere?.id === appointment.id ? undefined : activeElsewhere}
          replacement={replacement}
          onCancel={() => setCancelOpen(true)}
        />
        {isActive && appointment.status !== 'CHECKED_IN' && (
          <PreparationGuidance phone={appointment.unit.phone} />
        )}
        {suggestPreScreening && (
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <ClipboardList
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-petroleo-700"
              />
              <div>
                <h2 className="font-bold text-ink">Pré-triagem (opcional)</h2>
                <p className="text-sm text-ink-muted">
                  Responda antes do dia para se preparar. É informativa e não muda o agendamento.
                </p>
              </div>
            </div>
            <ButtonLink to="/app/pre-triagem" variant="outline">
              Fazer pré-triagem
            </ButtonLink>
          </Card>
        )}
      </div>

      <CancelAppointmentDialog
        appointment={appointment}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onStale={onStale}
        onCancelled={() => {
          setCancelOpen(false);
          setJustCancelled(true);
        }}
      />
    </>
  );
}

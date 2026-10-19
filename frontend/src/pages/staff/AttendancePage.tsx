import { ArrowLeft, Lock } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { hasPermission } from '@pulso/contracts';
import { Alert, EmptyState, PageHeader, ProblemAlert, QueryState } from '@/components/ui';
import { useSession } from '@/features/auth/use-auth';
import {
  useAttendance,
  useCheckIn,
  useScreeningFields,
  useStaffAppointment,
} from '@/features/staff/api';
import { AttendanceOutcome } from '@/features/staff/AttendanceOutcome';
import { DonationForm } from '@/features/staff/DonationForm';
import { DonorHeader } from '@/features/staff/DonorHeader';
import { ScreeningForm } from '@/features/staff/ScreeningForm';
import { SharedPreScreeningPanel } from '@/features/staff/SharedPreScreeningPanel';
import { isApiError } from '@/lib/api';
import { todayIso, toIsoDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Atendimento: check-in (recepção) e triagem e doação (enfermagem). */
export function AttendancePage() {
  useDocumentTitle('Atendimento');
  const { appointmentId = '' } = useParams();
  const location = useLocation();
  const backTo = `/equipe${location.search}`;
  const { user } = useSession();
  const isNurse = user ? hasPermission(user.role, 'screening:perform') : false;
  const appointment = useStaffAppointment(appointmentId);
  const status = appointment.data?.status;
  const attendance = useAttendance(appointmentId, isNurse && Boolean(appointment.data));
  const fields = useScreeningFields(isNurse);
  const checkIn = useCheckIn();

  const notFound = isApiError(appointment.error) && appointment.error.status === 404;
  // A pré-triagem compartilhada só é liberada com o atendimento em aberto (regra da API).
  const preScreeningOpen =
    !attendance.data?.completed &&
    (status === 'CHECKED_IN' ||
      ((status === 'BOOKED' || status === 'CONFIRMED') &&
        appointment.data !== undefined &&
        toIsoDate(appointment.data.startsAt) === todayIso()));

  return (
    <>
      <Link
        to={backTo}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-petroleo-700 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Agenda do dia
      </Link>
      <PageHeader title="Atendimento" />
      {notFound ? (
        <EmptyState
          icon={Lock}
          title="Agendamento não encontrado"
          description="Ele pode ser de outra unidade ou o endereço está incorreto."
        />
      ) : (
        <QueryState
          isLoading={appointment.isLoading}
          error={appointment.error}
          onRetry={() => appointment.refetch()}
        >
          {appointment.data && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              {/* Os dados do doador ficam à vista enquanto a enfermagem rola o atendimento. */}
              <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                <DonorHeader
                  appointment={appointment.data}
                  canCheckIn={user ? hasPermission(user.role, 'appointment:check-in') : false}
                  checkingIn={checkIn.isPending}
                  onCheckIn={() => checkIn.mutate(appointmentId)}
                />
                <ProblemAlert error={checkIn.error} />
              </div>
              <div className="min-w-0 space-y-6">
                {!isNurse ? (
                  <Alert tone="info" title="Triagem e doação">
                    A triagem e o registro da doação são feitos pela enfermagem. Depois do check-in,
                    o doador aguarda a chamada.
                  </Alert>
                ) : (
                  <>
                    {preScreeningOpen && <SharedPreScreeningPanel appointmentId={appointmentId} />}
                    <QueryState
                      isLoading={attendance.isLoading || fields.isLoading}
                      error={attendance.error ?? fields.error}
                      onRetry={() => {
                        void attendance.refetch();
                        void fields.refetch();
                      }}
                    >
                      {attendance.data ? (
                        <>
                          <AttendanceOutcome attendance={attendance.data} backTo={backTo} />
                          {attendance.data.result === 'FIT' &&
                            !attendance.data.donation &&
                            !attendance.data.completed && (
                              <DonationForm
                                attendanceId={attendance.data.id}
                                declaredBloodType={appointment.data.donorSummary.declaredBloodType}
                              />
                            )}
                        </>
                      ) : status === 'CHECKED_IN' ? (
                        fields.data && (
                          <ScreeningForm appointmentId={appointmentId} fields={fields.data} />
                        )
                      ) : status === 'BOOKED' || status === 'CONFIRMED' ? (
                        <Alert tone="info">Faça o check-in para liberar a triagem.</Alert>
                      ) : (
                        <Alert tone="info">Este agendamento não tem atendimento em aberto.</Alert>
                      )}
                    </QueryState>
                  </>
                )}
              </div>
            </div>
          )}
        </QueryState>
      )}
    </>
  );
}

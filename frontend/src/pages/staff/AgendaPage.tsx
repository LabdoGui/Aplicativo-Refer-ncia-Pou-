import { useState } from 'react';
import { CalendarX2 } from 'lucide-react';
import type { AgendaItem } from '@pulso/contracts';
import {
  Alert,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  ProblemAlert,
  QueryState,
} from '@/components/ui';
import { useSession } from '@/features/auth/use-auth';
import { AgendaTable } from '@/features/staff/AgendaTable';
import { AgendaToolbar } from '@/features/staff/AgendaToolbar';
import { useAgenda, useCheckIn, useNoShow, useUnits } from '@/features/staff/api';
import { StatusCounts } from '@/features/staff/StatusCounts';
import { useAgendaParams } from '@/features/staff/use-agenda-params';
import { formatTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Agenda do dia da unidade: check-in, falta e acesso ao atendimento. */
export function AgendaPage() {
  useDocumentTitle('Atendimentos do dia');
  const { user } = useSession();
  const units = useUnits();
  const myUnits = (units.data ?? []).filter((unit) => user?.unitIds.includes(unit.id));
  const { unitId, date, update } = useAgendaParams(myUnits.map((unit) => unit.id));
  const agenda = useAgenda(unitId, date);
  const checkIn = useCheckIn();
  const noShow = useNoShow();
  const [noShowTarget, setNoShowTarget] = useState<AgendaItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleCheckIn(item: AgendaItem) {
    setNotice(null);
    noShow.reset();
    checkIn.mutate(item.appointmentId, {
      onSuccess: () => setNotice(`Check-in de ${item.donor.name} registrado.`),
    });
  }

  function confirmNoShow() {
    if (!noShowTarget) return;
    const target = noShowTarget;
    setNotice(null);
    checkIn.reset();
    noShow.mutate(target.appointmentId, {
      onSuccess: () => {
        setNotice(`Falta de ${target.donor.name} registrada.`);
        setNoShowTarget(null);
      },
    });
  }

  const search = `?unidade=${unitId ?? ''}&data=${date}`;

  return (
    <>
      <PageHeader
        title="Atendimentos do dia"
        description="Confira quem está agendado, faça o check-in na chegada e abra o atendimento."
      />
      <QueryState isLoading={units.isLoading} error={units.error} onRetry={() => units.refetch()}>
        {myUnits.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="Nenhuma unidade vinculada"
            description="Peça à administração para vincular sua conta a uma unidade de coleta."
          />
        ) : (
          <div className="space-y-5">
            <AgendaToolbar units={myUnits} unitId={unitId} date={date} onChange={update} />
            {agenda.data?.earlyCheckInAllowed && (
              <Alert tone="info" title="Modo demonstração">
                O check-in antecipado está liberado para agendamentos de dias futuros, para
                percorrer a jornada completa numa só sessão. Em uso real, o check-in vale só no dia.
              </Alert>
            )}
            <div aria-live="polite">
              {notice && (
                <Alert tone="ok" role="status">
                  {notice}
                </Alert>
              )}
            </div>
            <ProblemAlert error={checkIn.error} />
            <QueryState
              isLoading={agenda.isLoading}
              error={agenda.error}
              onRetry={() => agenda.refetch()}
              loadingLabel="Carregando a agenda…"
            >
              {agenda.data && agenda.data.items.length === 0 ? (
                <EmptyState
                  icon={CalendarX2}
                  title="Nenhum agendamento neste dia"
                  description="Escolha outro dia ou outra unidade."
                />
              ) : (
                agenda.data && (
                  <div className="space-y-3">
                    <StatusCounts counts={agenda.data.counts} />
                    <AgendaTable
                      items={agenda.data.items}
                      attendancePath={(id) => `/equipe/atendimentos/${id}${search}`}
                      pendingId={checkIn.isPending ? (checkIn.variables ?? null) : null}
                      onCheckIn={handleCheckIn}
                      onNoShow={setNoShowTarget}
                      earlyCheckInAllowed={agenda.data.earlyCheckInAllowed}
                    />
                  </div>
                )
              )}
            </QueryState>
          </div>
        )}
      </QueryState>
      <Dialog
        open={noShowTarget !== null}
        onClose={() => setNoShowTarget(null)}
        title="Registrar falta?"
        description={
          noShowTarget &&
          `${noShowTarget.donor.name} não compareceu ao horário das ${formatTime(noShowTarget.startsAt)}. A falta fica registrada e não pode ser desfeita.`
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => setNoShowTarget(null)}>
              Voltar
            </Button>
            <Button variant="danger" loading={noShow.isPending} onClick={confirmNoShow}>
              Registrar falta
            </Button>
          </>
        }
      >
        <ProblemAlert error={noShow.error} />
      </Dialog>
    </>
  );
}

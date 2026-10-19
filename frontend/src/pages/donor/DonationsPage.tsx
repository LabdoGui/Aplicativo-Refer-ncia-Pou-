import { CalendarPlus, Droplet, FileText } from 'lucide-react';
import { ButtonLink, EmptyState, PageHeader, QueryState, StatCard } from '@/components/ui';
import { useDonationHistory } from '@/features/donor/api';
import { AttendanceListItem } from '@/features/donor/history/AttendanceListItem';
import { EligibilityCard } from '@/features/donor/history/EligibilityCard';
import { isCompletedDonation } from '@/features/donor/history/outcome';
import { useDocumentTitle } from '@/lib/use-document-title';

/** "Minhas doações": atendimentos e doações registrados pela equipe (sem dados da triagem). */
export function DonationsPage() {
  useDocumentTitle('Minhas doações');
  const history = useDonationHistory();
  const attendances = history.data ?? [];
  const completed = attendances.filter(isCompletedDonation).length;

  return (
    <>
      <PageHeader
        title="Minhas doações"
        description="Seus comparecimentos e doações, como a equipe da unidade registrou."
        actions={
          attendances.length > 0 && (
            <ButtonLink to="/app/documentos" variant="outline">
              <FileText aria-hidden="true" className="size-4" />
              Meus documentos
            </ButtonLink>
          )
        }
      />
      <QueryState
        isLoading={history.isLoading}
        error={history.error}
        onRetry={() => history.refetch()}
        loadingLabel="Carregando suas doações…"
      >
        {attendances.length === 0 ? (
          <EmptyState
            icon={Droplet}
            title="Nenhuma doação registrada ainda"
            description="Depois do seu primeiro atendimento na unidade, ele aparece aqui com as declarações para baixar."
          >
            <ButtonLink to="/app/agendar">
              <CalendarPlus aria-hidden="true" className="size-5" />
              Agendar doação
            </ButtonLink>
          </EmptyState>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Doações concluídas"
                value={completed}
                icon={Droplet}
                hint={
                  attendances.length === 1
                    ? '1 atendimento registrado'
                    : `${attendances.length} atendimentos registrados`
                }
              />
              <EligibilityCard
                actionWhenAvailable={
                  <ButtonLink to="/app/agendar" variant="outline" size="sm">
                    <CalendarPlus aria-hidden="true" className="size-4" />
                    Agendar doação
                  </ButtonLink>
                }
              />
            </div>
            <section aria-labelledby="historico">
              <h2 id="historico" className="text-lg font-bold text-ink">
                Histórico
              </h2>
              <ul className="mt-4 space-y-3">
                {attendances.map((attendance) => (
                  <AttendanceListItem key={attendance.id} attendance={attendance} />
                ))}
              </ul>
            </section>
          </div>
        )}
      </QueryState>
    </>
  );
}

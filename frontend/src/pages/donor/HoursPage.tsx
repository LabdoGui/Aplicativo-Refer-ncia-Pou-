import { GraduationCap } from 'lucide-react';
import { Card, EmptyState, PageHeader, QueryState } from '@/components/ui';
import { useMyHours } from '@/features/donor/api';
import { HoursRequestItem } from '@/features/donor/engagement/HoursRequestItem';
import { HoursTotals } from '@/features/donor/engagement/HoursTotals';
import { InstitutionCard } from '@/features/donor/engagement/InstitutionCard';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Horas complementares: vínculo com a instituição, totais e pedidos (RN15). */
export function HoursPage() {
  useDocumentTitle('Horas complementares');
  const hours = useMyHours();
  const data = hours.data;

  return (
    <>
      <PageHeader
        title="Horas complementares"
        description="Para estudantes: cada doação concluída pode gerar um pedido de horas na sua instituição de ensino."
      />
      <QueryState
        isLoading={hours.isLoading}
        error={hours.error}
        onRetry={() => hours.refetch()}
        loadingLabel="Carregando suas horas…"
      >
        {data && (
          <div className="space-y-6">
            <InstitutionCard hours={data} />
            <HoursTotals totals={data.totals} />
            <section aria-labelledby="pedidos-horas">
              <h2 id="pedidos-horas" className="text-lg font-bold text-ink">
                Pedidos de horas
              </h2>
              {data.items.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  headingLevel={3}
                  title="Nenhum pedido de horas ainda"
                  className="mt-4"
                  description={
                    data.institution
                      ? 'Quando você concluir uma doação, o pedido é criado e enviado à instituição para análise.'
                      : 'Vincule sua instituição acima para que as próximas doações gerem pedidos de horas.'
                  }
                />
              ) : (
                <Card className="mt-4">
                  <ul className="divide-y divide-line">
                    {data.items.map((item) => (
                      <HoursRequestItem key={item.id} item={item} />
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          </div>
        )}
      </QueryState>
    </>
  );
}

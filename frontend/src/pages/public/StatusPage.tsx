import { Activity } from 'lucide-react';
import { Alert, Button, EmptyState, PageHeader, Spinner } from '@/components/ui';
import { OverallStatus } from '@/features/system-status/OverallStatus';
import { ServiceStatusCard } from '@/features/system-status/ServiceStatusCard';
import { useServicesHealth } from '@/features/system-status/use-services-health';
import { PublicContainer } from '@/layouts/public/PublicContainer';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

export function StatusPage() {
  useDocumentTitle('Status do sistema');
  const { data, error, isPending, isError, isFetching, refetch, dataUpdatedAt } =
    useServicesHealth();

  return (
    <PublicContainer>
      <PageHeader
        eyebrow="Transparência"
        title="Status do sistema"
        description="Situação em tempo real dos serviços do Pulso, com banco de dados e mensageria. Atualiza sozinha a cada 10 segundos."
      />

      {isPending && (
        <div className="flex justify-center py-16 text-petroleo-700">
          <Spinner size="lg" label="Verificando os serviços…" />
        </div>
      )}

      {isError && (
        <Alert
          role="alert"
          tone="critical"
          title="Não foi possível consultar o status agora"
          className="mb-6"
          actions={
            <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>
              Tentar novamente
            </Button>
          }
        >
          <p>{error.message}</p>
          <p className="mt-1">
            O gateway pode estar desligado ou ainda iniciando. Vamos tentar de novo automaticamente.
            {data && ` Abaixo, os últimos dados recebidos (${formatDateTime(dataUpdatedAt)}).`}
          </p>
        </Alert>
      )}

      {data && (
        <div className="space-y-6">
          <OverallStatus health={data} isRefreshing={isFetching} />
          {data.services.length === 0 ? (
            <EmptyState
              icon={Activity}
              headingLevel={2}
              title="Nenhum serviço informado"
              description="O gateway respondeu, mas não listou nenhum serviço."
            />
          ) : (
            <section aria-labelledby="servicos-titulo">
              <h2 id="servicos-titulo" className="mb-4 text-lg font-bold text-ink">
                Serviços
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.services.map((service) => (
                  <li key={service.name}>
                    <ServiceStatusCard service={service} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PublicContainer>
  );
}

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { Alert, Button, EmptyState, PageHeader, Spinner } from '@/components/ui';
import { OverallStatus } from '@/features/system-status/OverallStatus';
import { ServiceStatusCard } from '@/features/system-status/ServiceStatusCard';
import { overallSummary } from '@/features/system-status/status-presentation';
import type { ServicesHealth } from '@/features/system-status/types';
import { useServicesHealth } from '@/features/system-status/use-services-health';
import { PublicContainer } from '@/layouts/public/PublicContainer';
import { useDocumentTitle } from '@/lib/use-document-title';

interface AnnouncementInput {
  retrying: boolean;
  isFailing: boolean;
  error: Error | null;
  data?: ServicesHealth;
}

/** Texto da região viva: só muda quando o resultado muda, e não a cada consulta de 10 s. */
function statusAnnouncement({ retrying, isFailing, error, data }: AnnouncementInput): string {
  if (retrying) return 'Consultando o status novamente…';
  if (isFailing) return `Não foi possível consultar o status agora. ${error?.message ?? ''}`.trim();
  return data ? overallSummary(data.status) : '';
}

export function StatusPage() {
  useDocumentTitle('Status do sistema');
  const { data, error, isFetching, refetch, dataUpdatedAt, errorUpdatedAt } = useServicesHealth();
  const [retrying, setRetrying] = useState(false);

  /*
   * O que exibir é decidido pelos horários do último resultado, e não por isPending/isError:
   * sem dados, o TanStack Query volta a consulta para "pending" (e apaga o erro) no início de
   * cada nova tentativa. Os horários não mudam durante a busca, então o alerta continua
   * montado entre as tentativas: sem novo anúncio, sem salto de layout e sem perder o foco.
   */
  const [lastError, setLastError] = useState<Error | null>(null);
  if (error && error !== lastError) setLastError(error);
  const shownError = error ?? lastError;
  const hasResult = dataUpdatedAt > 0 || errorUpdatedAt > 0;
  const isFailing = errorUpdatedAt > dataUpdatedAt;

  const announcement = statusAnnouncement({ retrying, isFailing, error: shownError, data });

  function retry() {
    setRetrying(true);
    void refetch().finally(() => setRetrying(false));
  }

  return (
    <PublicContainer>
      <PageHeader
        eyebrow="Transparência"
        title="Status do sistema"
        description="Situação em tempo real dos serviços do SangueConecta, com banco de dados e mensageria. Atualiza sozinha a cada 10 segundos."
      />

      {/* Uma única região viva, sempre montada (alerta e cartões não são regiões vivas). */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {!hasResult && (
        <div className="flex justify-center py-16 text-petroleo-700">
          <Spinner size="lg" label="Verificando os serviços…" />
        </div>
      )}

      {isFailing && (
        <Alert
          tone="critical"
          title="Não foi possível consultar o status agora"
          className="mb-6"
          actions={
            <Button variant="outline" size="sm" onClick={retry} loading={isFetching}>
              Tentar novamente
            </Button>
          }
        >
          {shownError && <p>{shownError.message}</p>}
          <p className="mt-1">
            O gateway pode estar desligado ou ainda iniciando. Vamos tentar de novo automaticamente.
            {data &&
              ' Abaixo, a última informação recebida, que pode não refletir a situação atual.'}
          </p>
        </Alert>
      )}

      {data && (
        <div className="space-y-6">
          <OverallStatus health={data} isRefreshing={isFetching} stale={isFailing} />
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
              {isFailing && (
                <p className="-mt-2 mb-4 text-sm text-ink-muted">
                  Última informação conhecida de cada serviço. A situação atual pode ser diferente.
                </p>
              )}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.services.map((service) => (
                  <li key={service.name}>
                    <ServiceStatusCard service={service} stale={isFailing} />
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

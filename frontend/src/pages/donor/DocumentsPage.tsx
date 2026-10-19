import { FileText } from 'lucide-react';
import { DOCUMENT_DISCLAIMER } from '@pulso/contracts';
import { Alert, ButtonLink, EmptyState, PageHeader, QueryState } from '@/components/ui';
import { useDocuments, useDonationHistory } from '@/features/donor/api';
import { DocumentCard } from '@/features/donor/documents/DocumentCard';
import { useDocumentTitle } from '@/lib/use-document-title';

/** "Meus documentos": declarações emitidas, com PDF e link de verificação. */
export function DocumentsPage() {
  useDocumentTitle('Meus documentos');
  const documents = useDocuments();
  // Só para mostrar data e unidade de cada atendimento; a lista não depende disso.
  const history = useDonationHistory();
  const attendanceById = new Map(history.data?.map((item) => [item.id, item]));
  const items = documents.data ?? [];

  return (
    <>
      <PageHeader
        title="Meus documentos"
        description="Declarações que você gerou. Qualquer pessoa pode conferir a autenticidade pelo código."
      />
      <QueryState
        isLoading={documents.isLoading}
        error={documents.error}
        onRetry={() => documents.refetch()}
        loadingLabel="Carregando seus documentos…"
      >
        {items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum documento emitido ainda"
            description="As declarações de comparecimento e de doação são geradas a partir de um atendimento, em Minhas doações."
          >
            <ButtonLink to="/app/doacoes" variant="secondary">
              Ir para Minhas doações
            </ButtonLink>
          </EmptyState>
        ) : (
          <div className="space-y-6">
            <ul className="space-y-4">
              {items.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  attendance={attendanceById.get(document.attendanceId)}
                />
              ))}
            </ul>
            <Alert tone="info">{DOCUMENT_DISCLAIMER}</Alert>
          </div>
        )}
      </QueryState>
    </>
  );
}

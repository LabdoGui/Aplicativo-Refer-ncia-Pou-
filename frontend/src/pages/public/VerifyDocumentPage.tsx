import { ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Card, PageHeader, QueryState } from '@/components/ui';
import { useDocumentVerification } from '@/features/public/api';
import { VerificationResult } from '@/features/public/VerificationResult';
import { VerifyForm } from '@/features/public/VerifyForm';
import { PublicContainer } from '@/layouts/public/PublicContainer';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Verificação pública de documentos: /verificar (formulário) e /verificar/:code (resultado). */
export function VerifyDocumentPage() {
  useDocumentTitle('Verificar documento');
  const { code: rawCode } = useParams();
  const code = rawCode?.trim() || undefined;
  const verification = useDocumentVerification(code);

  return (
    <PublicContainer size="narrow">
      <PageHeader
        eyebrow="Autenticidade"
        title="Verificar documento"
        description="Confira se uma declaração emitida pelo SangueConecta é autêntica. Mostramos só o necessário: nunca o nome completo nem dados de saúde."
      />
      <div className="space-y-6">
        {code && (
          <div aria-live="polite">
            <QueryState
              isLoading={verification.isLoading}
              error={verification.error}
              onRetry={() => verification.refetch()}
              loadingLabel="Verificando o código…"
            >
              {verification.data && <VerificationResult code={code} result={verification.data} />}
            </QueryState>
          </div>
        )}
        <Card as="section" aria-labelledby="verificar-codigo">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <h2 id="verificar-codigo" className="text-lg font-bold text-ink">
              {code ? 'Verificar outro código' : 'Digite o código do documento'}
            </h2>
          </div>
          <VerifyForm initialCode={code && verification.data?.valid === false ? code : ''} />
        </Card>
      </div>
    </PublicContainer>
  );
}

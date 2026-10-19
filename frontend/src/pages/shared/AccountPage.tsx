import { ROLE_LABELS } from '@pulso/contracts';
import { Card, PageHeader, QueryState } from '@/components/ui';
import { useMe } from '@/features/account/api';
import { PasswordForm } from '@/features/account/PasswordForm';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Conta da equipe e da administração: dados de acesso e troca de senha (a
 * senha inicial definida pela administração deve ser trocada no primeiro acesso).
 * Nome, papel e unidades são mantidos pela administração.
 */
export function AccountPage() {
  useDocumentTitle('Minha conta');
  const me = useMe();
  return (
    <>
      <PageHeader
        title="Minha conta"
        description="Seus dados de acesso. Troque a senha inicial no primeiro acesso."
      />
      <QueryState isLoading={me.isLoading} error={me.error} onRetry={() => me.refetch()}>
        {me.data && (
          <div className="space-y-6">
            <Card as="section" aria-labelledby="dados-conta">
              <h2 id="dados-conta" className="text-lg font-bold text-ink">
                Dados de acesso
              </h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-ink-muted">Nome</dt>
                  <dd className="font-semibold text-ink">{me.data.name}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-ink-muted">E-mail</dt>
                  <dd className="font-semibold break-words text-ink">{me.data.email}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Perfil</dt>
                  <dd className="font-semibold text-ink">{ROLE_LABELS[me.data.role]}</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-ink-muted">
                Para corrigir nome, perfil ou unidades, fale com a administração.
              </p>
            </Card>
            <PasswordForm />
          </div>
        )}
      </QueryState>
    </>
  );
}

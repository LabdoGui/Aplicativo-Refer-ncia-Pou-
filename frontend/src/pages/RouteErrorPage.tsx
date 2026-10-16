import { OctagonAlert } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button, ButtonLink, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Tela de erro inesperado do roteador (falha ao renderizar uma página). */
export function RouteErrorPage() {
  useDocumentTitle('Algo deu errado');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo />
      <main className="w-full max-w-xl">
        <EmptyState
          icon={OctagonAlert}
          headingLevel={1}
          title="Algo deu errado"
          description="Não foi possível exibir esta página. Tente recarregar; se o problema continuar, volte mais tarde."
        >
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Recarregar a página
          </Button>
          <ButtonLink to="/" variant="outline" reloadDocument>
            Ir para a página inicial
          </ButtonLink>
        </EmptyState>
      </main>
    </div>
  );
}

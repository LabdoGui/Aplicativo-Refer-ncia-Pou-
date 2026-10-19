import { SearchX } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/lib/use-document-title';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada');
  return (
    <EmptyState
      icon={SearchX}
      headingLevel={1}
      title="Página não encontrada"
      description="O endereço pode ter sido digitado errado ou a página mudou de lugar."
    >
      <ButtonLink to="/" variant="secondary">
        Ir para a página inicial
      </ButtonLink>
      <ButtonLink to="/status" variant="outline">
        Ver status do sistema
      </ButtonLink>
    </EmptyState>
  );
}

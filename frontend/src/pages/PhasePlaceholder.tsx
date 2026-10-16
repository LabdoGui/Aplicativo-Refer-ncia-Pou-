import { Construction } from 'lucide-react';
import { ROADMAP_PHASES } from '@/app/roadmap';
import { ButtonLink, EmptyState, PageHeader } from '@/components/ui';
import { useDocumentTitle } from '@/lib/use-document-title';

interface PhasePlaceholderProps {
  title: string;
  /** Fase do roadmap (docs/16) em que a funcionalidade será entregue. */
  phase: number;
  /** Link de retorno opcional (usado nas páginas públicas, que não têm menu lateral). */
  backTo?: { to: string; label: string };
}

/** Estado honesto para telas ainda não implementadas: sem botões nem dados fictícios. */
export function PhasePlaceholder({ title, phase, backTo }: PhasePlaceholderProps) {
  useDocumentTitle(title);
  const phaseTitle = ROADMAP_PHASES[phase];

  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="Em construção"
        description={
          <>
            <p>
              Esta funcionalidade chega na <strong className="text-ink">Fase {phase}</strong> do
              roadmap.
            </p>
            {phaseTitle && (
              <p className="mt-1 text-sm">
                Fase {phase}: {phaseTitle}.
              </p>
            )}
          </>
        }
      >
        {backTo && (
          <ButtonLink to={backTo.to} variant="outline">
            {backTo.label}
          </ButtonLink>
        )}
      </EmptyState>
    </>
  );
}

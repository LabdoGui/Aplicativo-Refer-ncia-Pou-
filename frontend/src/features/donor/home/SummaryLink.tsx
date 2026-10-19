import type { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SummaryLinkProps {
  to: string;
  icon: LucideIcon;
  /** Texto do link (também é o título do cartão). */
  title: string;
  children: ReactNode;
}

/**
 * Cartão de resumo inteiro clicável. O link fica só no título (nome acessível curto)
 * e cobre o cartão com um pseudo-elemento; o anel de foco vai para o cartão todo.
 */
export function SummaryLink({ to, icon: Icon, title, children }: SummaryLinkProps) {
  return (
    <li className="relative flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-petroleo-300 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-petroleo-600">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-petroleo-50 text-petroleo-700">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-ink-muted">
          <Link
            to={to}
            className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
          >
            {title}
          </Link>
        </h3>
        <div className="mt-1 text-ink">{children}</div>
      </div>
      <ChevronRight aria-hidden="true" className="mt-2 size-5 shrink-0 text-ink-muted" />
    </li>
  );
}

/** Conteúdo padrão enquanto carrega ou quando o serviço falha (o resto da página segue). */
export function SummaryFallback({ isLoading }: { isLoading: boolean }) {
  return (
    <p className="text-sm text-ink-muted">
      {isLoading ? 'Carregando…' : 'Indisponível no momento.'}
    </p>
  );
}

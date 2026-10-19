import { Link, NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

const LINK_CLASS =
  'min-h-11 items-center rounded-control px-3 text-[0.9375rem] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-petroleo-800';

interface PublicNavLinksProps {
  vertical?: boolean;
}

/** Links da navegação pública (cabeçalho e menu do celular). */
export function PublicNavLinks({ vertical = false }: PublicNavLinksProps) {
  const itemClass = cn(LINK_CLASS, vertical ? 'flex w-full' : 'inline-flex');
  return (
    <ul className={vertical ? 'flex flex-col gap-1' : 'flex items-center gap-1'}>
      <li>
        {/* Âncora da landing: Link simples, pois não representa uma página "atual". */}
        <Link to="/#como-funciona" className={itemClass}>
          Como funciona
        </Link>
      </li>
      <li>
        <NavLink to="/privacidade" className={itemClass}>
          Privacidade
        </NavLink>
      </li>
      <li>
        <NavLink to="/status" className={itemClass}>
          Status do sistema
        </NavLink>
      </li>
    </ul>
  );
}

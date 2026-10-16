import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui';
import { PublicNavLinks } from './PublicNavLinks';

const MOBILE_MENU_ID = 'menu-publico';

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-page items-center gap-3 px-4 sm:px-6 md:gap-6">
        <Link
          to="/"
          aria-label="Pulso — página inicial"
          className="rounded-control"
          onClick={closeMenu}
        >
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <PublicNavLinks />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:block">
            <ButtonLink to="/entrar" variant="ghost">
              Entrar
            </ButtonLink>
          </span>
          <ButtonLink to="/cadastro" variant="primary">
            Quero doar
          </ButtonLink>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-control text-petroleo-800 hover:bg-surface-muted md:hidden"
            aria-expanded={menuOpen}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
            <span className="sr-only">{menuOpen ? 'Fechar menu' : 'Abrir menu'}</span>
          </button>
        </div>
      </div>

      <nav
        id={MOBILE_MENU_ID}
        aria-label="Principal"
        hidden={!menuOpen}
        className="border-t border-line bg-surface px-4 py-3 md:hidden"
      >
        <PublicNavLinks vertical onNavigate={closeMenu} />
        <NavLink
          to="/entrar"
          onClick={closeMenu}
          className="mt-1 flex min-h-11 items-center rounded-control px-3 font-medium text-petroleo-800 hover:bg-surface-muted sm:hidden"
        >
          Entrar
        </NavLink>
      </nav>
    </header>
  );
}

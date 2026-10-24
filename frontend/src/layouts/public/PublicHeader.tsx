import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { ROLE_HOME } from '@pulso/contracts';
import { ButtonLink } from '@/components/ui';
import { useSession } from '@/features/auth/use-auth';
import { PublicNavLinks } from './PublicNavLinks';

const MOBILE_MENU_ID = 'menu-publico';

export function PublicHeader() {
  const location = useLocation();
  const { user } = useSession();
  const toggleRef = useRef<HTMLButtonElement>(null);
  /*
   * O menu fica aberto só na navegação em que foi aberto (cada uma tem uma `key` própria).
   * Assim, qualquer navegação fecha o menu: links do menu, CTA "Quero doar", logo e também
   * voltar/avançar do navegador, sem depender de um onClick em cada link.
   */
  const [openAtKey, setOpenAtKey] = useState<string | null>(null);
  const menuOpen = openAtKey === location.key;

  // Esc fecha o menu e devolve o foco ao botão que o abriu.
  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setOpenAtKey(null);
      // Só move o foco se ele estava no cabeçalho (ou em lugar nenhum), para não tirar o
      // usuário de outro ponto da página.
      const active = document.activeElement;
      const header = toggleRef.current?.closest('header');
      if (!active || active === document.body || header?.contains(active)) {
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-page items-center gap-2 px-4 sm:gap-3 sm:px-6 md:gap-6">
        <Link to="/" aria-label="SangueConecta — página inicial" className="rounded-control">
          <Logo collapsible />
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <PublicNavLinks />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <ButtonLink to={ROLE_HOME[user.role]} variant="secondary">
              Minha área
            </ButtonLink>
          ) : (
            <>
              <span className="hidden sm:block">
                <ButtonLink to="/entrar" variant="ghost">
                  Entrar
                </ButtonLink>
              </span>
              <ButtonLink to="/cadastro" variant="primary">
                Quero doar
              </ButtonLink>
            </>
          )}
          <button
            ref={toggleRef}
            type="button"
            className="grid size-11 place-items-center rounded-control text-petroleo-800 hover:bg-surface-muted md:hidden"
            aria-expanded={menuOpen}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setOpenAtKey(menuOpen ? null : location.key)}
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
        <PublicNavLinks vertical />
        {!user && (
          <NavLink
            to="/entrar"
            className="mt-1 flex min-h-11 items-center rounded-control px-3 font-medium text-petroleo-800 hover:bg-surface-muted sm:hidden"
          >
            Entrar
          </NavLink>
        )}
      </nav>
    </header>
  );
}

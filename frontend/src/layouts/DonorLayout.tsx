import { Link, Outlet } from 'react-router-dom';
import { DONOR_NAV, DONOR_NOTIFICATIONS } from '@/app/navigation';
import { Logo } from '@/components/brand/Logo';
import { AccountMenu } from '@/components/navigation/AccountMenu';
import { BottomNav } from '@/components/navigation/BottomNav';
import { NotificationBell } from '@/components/navigation/NotificationBell';
import { SideNavList } from '@/components/navigation/SideNavList';
import { SkipLink } from '@/components/ui';
import { AppFooter } from './shared/AppFooter';
import { MainContent } from './shared/MainContent';

const NAV_LABEL = 'Área do doador';
const DONOR_ACCOUNT_LINKS = [
  { to: '/app/perfil', label: 'Meu perfil' },
  { to: '/app/documentos', label: 'Meus documentos' },
  { to: '/app/horas', label: 'Horas complementares' },
  { to: '/app/privacidade', label: 'Privacidade e dados' },
];

/**
 * Área do doador (/app): mobile-first, com navegação inferior no celular
 * e barra lateral clara a partir de telas grandes (lg).
 */
export function DonorLayout() {
  return (
    <div className="min-h-dvh lg:flex">
      <SkipLink />

      <div className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-6">
          <Link
            to="/app"
            aria-label="SangueConecta — início da área do doador"
            className="rounded-control"
          >
            <Logo />
          </Link>
        </div>
        <nav aria-label={NAV_LABEL} className="flex-1 overflow-y-auto px-3 py-4">
          <SideNavList items={DONOR_NAV} />
        </nav>
      </div>

      {/* Espaço inferior para a navegação fixa do celular (inclui a área segura do iOS). */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Link
            to="/app"
            aria-label="SangueConecta — início da área do doador"
            className="rounded-control lg:hidden"
          >
            <Logo size="sm" />
          </Link>
          <p className="hidden text-sm font-medium text-ink-muted lg:block">{NAV_LABEL}</p>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell to={DONOR_NOTIFICATIONS.to} />
            <AccountMenu links={DONOR_ACCOUNT_LINKS} />
          </div>
        </header>

        <MainContent className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-4xl">
            <Outlet />
          </div>
        </MainContent>

        <AppFooter />
      </div>

      <BottomNav items={DONOR_NAV} label={NAV_LABEL} className="lg:hidden" />
    </div>
  );
}

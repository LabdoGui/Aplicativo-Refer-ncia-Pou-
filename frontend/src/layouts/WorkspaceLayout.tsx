import { useId, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { NavDrawer } from '@/components/navigation/NavDrawer';
import { SideNavList } from '@/components/navigation/SideNavList';
import type { NavItem } from '@/components/navigation/types';
import { AccountMenu } from '@/components/navigation/AccountMenu';
import { NotificationBell } from '@/components/navigation/NotificationBell';
import { Badge, SkipLink } from '@/components/ui';
import { AppFooter } from './shared/AppFooter';
import { MainContent } from './shared/MainContent';
import { SidebarBrand } from './shared/SidebarBrand';

interface WorkspaceLayoutProps {
  /** Nome da área (ex.: "Administração"), usado também como rótulo da navegação. */
  areaLabel: string;
  homePath: string;
  items: readonly NavItem[];
  /** Central de notificações da área (sino no topo). */
  notificationsPath?: string;
}

/**
 * Casca desktop-first das áreas profissionais (equipe e administração):
 * barra lateral petróleo fixa em telas grandes e menu em gaveta (dialog) no celular/tablet.
 */
export function WorkspaceLayout({
  areaLabel,
  homePath,
  items,
  notificationsPath,
}: WorkspaceLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-dvh lg:flex">
      <SkipLink />

      <div className="on-dark sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-petroleo-900 text-white lg:flex">
        <div className="px-3">
          <SidebarBrand areaLabel={areaLabel} homePath={homePath} />
        </div>
        <nav aria-label={areaLabel} className="flex-1 overflow-y-auto px-3 py-3">
          <SideNavList items={items} tone="dark" />
        </nav>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-surface px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-control text-petroleo-800 hover:bg-surface-muted lg:hidden"
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden="true" className="size-5" />
            <span className="sr-only">Abrir menu</span>
          </button>
          <Link
            to={homePath}
            aria-label={`SangueConecta — início: ${areaLabel}`}
            className="rounded-control lg:hidden"
          >
            <Logo size="sm" collapsible />
          </Link>
          <p className="hidden text-sm font-semibold text-petroleo-800 lg:block">{areaLabel}</p>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone="neutral" className="max-sm:hidden">
              Dados fictícios
            </Badge>
            {notificationsPath && <NotificationBell to={notificationsPath} />}
            <AccountMenu links={[{ to: `${homePath}/conta`, label: 'Minha conta' }]} />
          </div>
        </header>

        <MainContent className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-page">
            <Outlet />
          </div>
        </MainContent>

        <AppFooter />
      </div>

      <NavDrawer id={drawerId} open={drawerOpen} onClose={closeDrawer} label={`Menu: ${areaLabel}`}>
        <SidebarBrand areaLabel={areaLabel} homePath={homePath} onNavigate={closeDrawer} />
        <nav aria-label={areaLabel} className="mt-2">
          <SideNavList items={items} tone="dark" onNavigate={closeDrawer} />
        </nav>
      </NavDrawer>
    </div>
  );
}

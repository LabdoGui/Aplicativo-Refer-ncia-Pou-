import type { RouteObject } from 'react-router-dom';
import type { NavItem } from '@/components/navigation/types';
import { AdminLayout } from '@/layouts/AdminLayout';
import { DonorLayout } from '@/layouts/DonorLayout';
import { PublicContainer } from '@/layouts/public/PublicContainer';
import { PublicLayout } from '@/layouts/PublicLayout';
import { StaffLayout } from '@/layouts/StaffLayout';
import { PhasePlaceholder } from '@/pages/PhasePlaceholder';
import { LandingPage } from '@/pages/public/LandingPage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';
import { PrivacyPage } from '@/pages/public/PrivacyPage';
import { StatusPage } from '@/pages/public/StatusPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import {
  ADMIN_NAV,
  DONOR_NAV,
  DONOR_NOTIFICATIONS,
  PUBLIC_PLACEHOLDERS,
  STAFF_NAV,
} from './navigation';
import { RootRoute } from './RootRoute';

/** Converte itens de navegação de uma área em rotas filhas com o PhasePlaceholder. */
function placeholderRoutes(items: readonly NavItem[], basePath: string): RouteObject[] {
  return items.map((item) => {
    const element = <PhasePlaceholder title={item.pageTitle ?? item.label} phase={item.phase} />;
    return item.to === basePath
      ? { index: true, element }
      : { path: item.to.slice(basePath.length + 1), element };
  });
}

const publicPlaceholderRoutes: RouteObject[] = PUBLIC_PLACEHOLDERS.map((item) => ({
  path: item.to.slice(1),
  element: (
    <PublicContainer>
      <PhasePlaceholder
        title={item.pageTitle ?? item.label}
        phase={item.phase}
        backTo={{ to: '/', label: 'Voltar para a página inicial' }}
      />
    </PublicContainer>
  ),
}));

const notFoundInArea: RouteObject = { path: '*', element: <NotFoundPage /> };

/** Árvore de rotas (separada do router para permitir renderização em testes/SSR). */
export const routes: RouteObject[] = [
  {
    element: <RootRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <LandingPage /> },
          { path: 'privacidade', element: <PrivacyPage /> },
          { path: 'status', element: <StatusPage /> },
          ...publicPlaceholderRoutes,
          {
            path: '*',
            element: (
              <PublicContainer>
                <NotFoundPage />
              </PublicContainer>
            ),
          },
        ],
      },
      // Fase 2: proteger as áreas abaixo com guarda de rota por papel
      // (ROLE_HOME e ROLE_PERMISSIONS de @pulso/contracts).
      {
        path: 'app',
        element: <DonorLayout />,
        children: [
          ...placeholderRoutes([...DONOR_NAV, DONOR_NOTIFICATIONS], '/app'),
          notFoundInArea,
        ],
      },
      {
        path: 'equipe',
        element: <StaffLayout />,
        children: [...placeholderRoutes(STAFF_NAV, '/equipe'), notFoundInArea],
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [...placeholderRoutes(ADMIN_NAV, '/admin'), notFoundInArea],
      },
    ],
  },
];

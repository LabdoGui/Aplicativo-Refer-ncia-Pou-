import { Outlet, ScrollRestoration } from 'react-router-dom';
import { RouteAnnouncer } from './RouteAnnouncer';

/** Rota raiz: restauração de rolagem (inclui âncoras como #como-funciona) e anúncio de página. */
export function RootRoute() {
  return (
    <>
      <ScrollRestoration />
      <RouteAnnouncer />
      <Outlet />
    </>
  );
}

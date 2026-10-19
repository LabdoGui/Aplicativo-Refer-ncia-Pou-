import { Outlet } from 'react-router-dom';
import { SkipLink } from '@/components/ui';
import { PublicFooter } from './public/PublicFooter';
import { PublicHeader } from './public/PublicHeader';
import { MainContent } from './shared/MainContent';

/** Layout das páginas públicas (landing, privacidade, status, entrar, cadastro). */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <PublicHeader />
      <MainContent>
        <Outlet />
      </MainContent>
      <PublicFooter />
    </div>
  );
}

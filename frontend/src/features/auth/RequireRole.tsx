import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ROLE_HOME, type Role } from '@pulso/contracts';
import { Spinner } from '@/components/ui';
import { useSession } from './use-auth';

interface RequireRoleProps {
  roles: readonly Role[];
  children: ReactNode;
}

/**
 * Guarda de rota por papel. A interface só esconde o que a pessoa não pode
 * usar: quem decide de verdade é a API (token, papel, escopo e posse do recurso).
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { status, user, endedReason } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center" role="status">
        <span className="flex items-center gap-3 text-ink-muted">
          <Spinner /> Carregando sua sessão…
        </span>
      </div>
    );
  }
  // Conta excluída pela própria pessoa: vai para o aviso na página inicial, não para o login.
  if (!user && endedReason === 'account-deleted') {
    return <Navigate to="/?conta-excluida=1" replace />;
  }
  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/entrar?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return children;
}

/** Destino seguro depois do login: só caminhos internos da área do papel. */
export function safeRedirect(redirect: string | null, role: Role): string {
  const home = ROLE_HOME[role];
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) return home;
  return redirect === home || redirect.startsWith(`${home}/`) ? redirect : home;
}

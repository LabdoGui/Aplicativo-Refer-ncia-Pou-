import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { restoreSession, sessionStore } from './session-store';

/** Restaura a sessão ao abrir o app e limpa o cache de dados quando o usuário sai. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    // Nada de dados de uma pessoa visíveis para a próxima que usar o mesmo navegador.
    if (state.status === 'anonymous') queryClient.clear();
  }, [state.status, state.user?.id, queryClient]);

  return children;
}

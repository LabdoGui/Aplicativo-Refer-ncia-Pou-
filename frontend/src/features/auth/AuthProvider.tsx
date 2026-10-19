import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { restoreSession, sessionStore } from './session-store';

/** Restaura a sessão ao abrir o app e limpa o cache de dados quando o usuário sai. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    // Nada de dados de uma pessoa visíveis para a próxima que usar o mesmo navegador:
    // ao sair (ou trocar de conta) os dados em cache são descartados. Só nessa
    // transição, não na abertura anônima do app. resetQueries (e não clear) para
    // que as consultas da tela atual, como os números públicos, busquem de novo
    // em vez de ficarem presas em "carregando".
    const userId = state.user?.id ?? null;
    if (previousUserId.current && previousUserId.current !== userId) {
      void queryClient.resetQueries();
    }
    previousUserId.current = userId;
  }, [state.user?.id, queryClient]);

  return children;
}

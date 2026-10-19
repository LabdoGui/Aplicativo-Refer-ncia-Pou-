import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GamificationProfile } from '@pulso/contracts';
import { donorKeys } from '@/features/donor/api';
import { apiGet } from '@/lib/api';

const POLL_INTERVAL_MS = 2_500;
const POLL_TIMEOUT_MS = 20_000;

/**
 * Perfil de gamificação que se atualiza sozinho até `isReady` ser verdadeiro (ou por até
 * ~20 s). Pontos e conquistas chegam por eventos, alguns segundos depois da doação.
 * Usa a mesma chave de cache de useGamificationProfile.
 */
export function useGamificationProfileUntil(
  isReady: (profile: GamificationProfile) => boolean,
  enabled: boolean,
) {
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);

  const query = useQuery({
    queryKey: donorKeys.profile,
    queryFn: ({ signal }) => apiGet<GamificationProfile>('/gamification/profile', { signal }),
    staleTime: 0,
    refetchInterval: (current) => {
      const data = current.state.data;
      if (!enabled || (data && isReady(data))) return false;
      return Date.now() - startedAt < POLL_TIMEOUT_MS ? POLL_INTERVAL_MS : false;
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), POLL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const ready = query.data ? isReady(query.data) : false;
  return {
    query,
    ready,
    /** Ainda esperando os eventos (mostra "processando"). */
    processing: enabled && !ready && !timedOut,
    /** Passou o tempo de espera sem os pontos chegarem. */
    timedOut: enabled && !ready && timedOut,
  };
}

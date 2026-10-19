import { useQuery } from '@tanstack/react-query';
import { apiGet, isApiError } from '@/lib/api';
import { isServicesHealth, type ServicesHealth } from './types';

export const SERVICES_HEALTH_REFRESH_MS = 10_000;

export async function fetchServicesHealth(signal: AbortSignal): Promise<ServicesHealth> {
  try {
    return await apiGet<ServicesHealth>('/health/services', { signal });
  } catch (error) {
    // Health checks costumam responder 503 quando algo está fora do ar, mas com o
    // relatório completo no corpo: nesse caso ainda é um resultado válido para exibir.
    if (isApiError(error) && error.status === 503 && isServicesHealth(error.payload)) {
      return error.payload;
    }
    throw error;
  }
}

/** Estado de cada serviço do back-end, atualizado a cada 10 segundos. */
export function useServicesHealth() {
  return useQuery({
    queryKey: ['health', 'services'],
    queryFn: ({ signal }) => fetchServicesHealth(signal),
    refetchInterval: SERVICES_HEALTH_REFRESH_MS,
    staleTime: 0,
    // Sem novas tentativas imediatas: o próprio intervalo de 10 s já tenta de novo.
    retry: false,
  });
}

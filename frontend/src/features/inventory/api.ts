import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BloodType,
  CreateMovementRequest,
  MovementView,
  Paginated,
  StockHistoryResponse,
  StockItemView,
  StockOverview,
  UpdateThresholdsRequest,
} from '@pulso/contracts';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

export const inventoryKeys = {
  all: ['admin', 'inventory'] as const,
  overview: ['admin', 'inventory', 'overview'] as const,
  history: (days: number) => ['admin', 'inventory', 'history', days] as const,
  movements: (params: string) => ['admin', 'inventory', 'movements', params] as const,
};

export const useStockOverview = () =>
  useQuery({
    queryKey: inventoryKeys.overview,
    queryFn: ({ signal }) => apiGet<StockOverview>('/blood-inventory', { signal }),
  });

export const useStockHistory = (days: number) =>
  useQuery({
    queryKey: inventoryKeys.history(days),
    queryFn: ({ signal }) =>
      apiGet<StockHistoryResponse>(`/blood-inventory/history?days=${days}`, { signal }),
    placeholderData: keepPreviousData,
  });

export function useMovements(filters: { bloodType?: string; type?: string; page: number }) {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: '15' });
  if (filters.bloodType) params.set('bloodType', filters.bloodType);
  if (filters.type) params.set('type', filters.type);
  const query = params.toString();
  return useQuery({
    queryKey: inventoryKeys.movements(query),
    queryFn: ({ signal }) =>
      apiGet<Paginated<MovementView>>(`/blood-inventory/movements?${query}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMovementRequest) =>
      apiPost<MovementView>('/blood-inventory/movements', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

export function useUpdateThresholds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bloodType, ...data }: UpdateThresholdsRequest & { bloodType: BloodType }) =>
      apiPatch<StockItemView>(`/blood-inventory/${bloodType}/thresholds`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}

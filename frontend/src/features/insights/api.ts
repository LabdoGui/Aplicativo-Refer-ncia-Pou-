import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  AdminDonationItem,
  DashboardStatistics,
  Paginated,
  StatsFilters,
} from '@pulso/contracts';
import { apiGet } from '@/lib/api';

export function statsQueryString(
  filters: StatsFilters,
  extra: Record<string, string | number | undefined> = {},
) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.unitId) params.set('unitId', filters.unitId);
  if (filters.bloodType) params.set('bloodType', filters.bloodType);
  for (const [key, value] of Object.entries(extra))
    if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
}

export function useDashboard(filters: StatsFilters) {
  return useQuery({
    queryKey: ['admin', 'dashboard', filters],
    queryFn: ({ signal }) =>
      apiGet<DashboardStatistics>(`/dashboard/statistics?${statsQueryString(filters)}`, { signal }),
    // Ao trocar o filtro, o painel mantém os números anteriores até chegar a nova resposta.
    placeholderData: keepPreviousData,
  });
}

export function useAdminDonations(filters: StatsFilters, status: string, page: number) {
  return useQuery({
    queryKey: ['admin', 'donations', filters, status, page],
    queryFn: ({ signal }) =>
      apiGet<Paginated<AdminDonationItem>>(
        `/admin/donations?${statsQueryString(filters, { status, page, pageSize: 20 })}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}

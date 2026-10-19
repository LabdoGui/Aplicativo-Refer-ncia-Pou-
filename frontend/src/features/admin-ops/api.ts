import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminAppointmentItem,
  AdminUserView,
  CampaignInput,
  CampaignView,
  CreateScheduleBlockRequest,
  CreateStaffUserRequest,
  Paginated,
  ReplaceScheduleRulesRequest,
  Role,
  ScheduleBlockView,
  ScheduleRuleView,
  UnitInput,
  UnitView,
  UpdateUserRequest,
} from '@pulso/contracts';
import { adminUnitsKey } from '@/features/admin/units';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';

const toQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') search.set(key, String(value));
  return search.toString();
};

// --- Agendamentos -------------------------------------------------------------

export interface AppointmentFilters {
  unitId?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
}

export function useAdminAppointments(filters: AppointmentFilters) {
  const query = toQuery({ ...filters, pageSize: 20 });
  return useQuery({
    queryKey: ['admin', 'appointments', query],
    queryFn: ({ signal }) =>
      apiGet<Paginated<AdminAppointmentItem>>(`/admin/appointments?${query}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPatch<void>(`/admin/appointments/${id}/cancel`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'appointments'] }),
  });
}

// --- Usuários -------------------------------------------------------------------

export function useAdminUsers(filters: {
  role: Role;
  search?: string;
  status?: string;
  page: number;
}) {
  const query = toQuery({ ...filters, pageSize: 20 });
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: ({ signal }) => apiGet<Paginated<AdminUserView>>(`/admin/users?${query}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStaffUserRequest) => apiPost<AdminUserView>('/admin/users', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateUserRequest & { id: string }) =>
      apiPatch<AdminUserView>(`/admin/users/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

// --- Unidades, grade e bloqueios --------------------------------------------------

export const useUnit = (id: string) =>
  useQuery({
    queryKey: ['admin', 'unit', id],
    queryFn: ({ signal }) => apiGet<UnitView>(`/units/${id}`, { signal }),
  });

export function useSaveUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<UnitInput> & { id?: string }) =>
      id ? apiPatch<UnitView>(`/units/${id}`, data) : apiPost<UnitView>('/units', data),
    onSuccess: (unit) => {
      queryClient.setQueryData(['admin', 'unit', unit.id], unit);
      void queryClient.invalidateQueries({ queryKey: adminUnitsKey });
      void queryClient.invalidateQueries({ queryKey: ['public', 'units'] });
    },
  });
}

export const useScheduleRules = (unitId: string) =>
  useQuery({
    queryKey: ['admin', 'unit', unitId, 'rules'],
    queryFn: ({ signal }) =>
      apiGet<ScheduleRuleView[]>(`/units/${unitId}/schedule-rules`, { signal }),
  });

export function useReplaceRules(unitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReplaceScheduleRulesRequest) =>
      apiPut<ScheduleRuleView[]>(`/units/${unitId}/schedule-rules`, data),
    onSuccess: (rules) => queryClient.setQueryData(['admin', 'unit', unitId, 'rules'], rules),
  });
}

export const useBlocks = (unitId: string) =>
  useQuery({
    queryKey: ['admin', 'unit', unitId, 'blocks'],
    queryFn: ({ signal }) => apiGet<ScheduleBlockView[]>(`/units/${unitId}/blocks`, { signal }),
  });

export function useCreateBlock(unitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateScheduleBlockRequest) =>
      apiPost<ScheduleBlockView>(`/units/${unitId}/blocks`, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'unit', unitId, 'blocks'] }),
  });
}

export function useDeleteBlock(unitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => apiDelete<void>(`/units/${unitId}/blocks/${blockId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'unit', unitId, 'blocks'] }),
  });
}

// --- Campanhas ----------------------------------------------------------------------

export const useAllCampaigns = () =>
  useQuery({
    queryKey: ['admin', 'campaigns'],
    queryFn: ({ signal }) => apiGet<CampaignView[]>('/campaigns?includeInactive=true', { signal }),
  });

export function useSaveCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: CampaignInput & { id?: string }) =>
      id
        ? apiPatch<CampaignView>(`/campaigns/${id}`, data)
        : apiPost<CampaignView>('/campaigns', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      void queryClient.invalidateQueries({ queryKey: ['public', 'campaigns'] });
    },
  });
}

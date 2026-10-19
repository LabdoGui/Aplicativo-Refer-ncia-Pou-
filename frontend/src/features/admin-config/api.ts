import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminAchievementView,
  AdminHoursItem,
  AuditLogsResponse,
  ClinicalSettingsView,
  GamificationSettingsView,
  InstitutionInput,
  InstitutionView,
  Paginated,
  ReviewHoursRequest,
  ScreeningConfigView,
  ScreeningFieldInput,
  ScreeningFieldView,
  UpdateAchievementRequest,
  UpdateClinicalSettingsRequest,
  UpdateGamificationSettingsRequest,
  UpdateQuestionRequest,
  UpdateScreeningRuleRequest,
} from '@pulso/contracts';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

function useInvalidating<V, R>(fn: (variables: V) => Promise<R>, key: readonly unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

// --- Gamificação ----------------------------------------------------------------

export const useAdminHours = (status: string, page: number) =>
  useQuery({
    queryKey: ['admin', 'hours', status, page],
    queryFn: ({ signal }) =>
      apiGet<Paginated<AdminHoursItem>>(
        `/admin/complementary-hours?page=${page}&pageSize=20${status ? `&status=${status}` : ''}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });

export const useReviewHours = () =>
  useInvalidating(
    ({ id, ...data }: ReviewHoursRequest & { id: string }) =>
      apiPatch<AdminHoursItem>(`/admin/complementary-hours/${id}`, data),
    ['admin', 'hours'],
  );

export const useAdminInstitutions = () =>
  useQuery({
    queryKey: ['admin', 'institutions'],
    queryFn: ({ signal }) => apiGet<InstitutionView[]>('/admin/institutions', { signal }),
  });

export const useSaveInstitution = () =>
  useInvalidating(
    ({ id, ...data }: Partial<InstitutionInput> & { id?: string }) =>
      id
        ? apiPatch<InstitutionView>(`/admin/institutions/${id}`, data)
        : apiPost<InstitutionView>('/admin/institutions', data),
    ['admin', 'institutions'],
  );

export const useAdminAchievements = () =>
  useQuery({
    queryKey: ['admin', 'achievements'],
    queryFn: ({ signal }) => apiGet<AdminAchievementView[]>('/admin/achievements', { signal }),
  });

export const useUpdateAchievement = () =>
  useInvalidating(
    ({ code, ...data }: UpdateAchievementRequest & { code: string }) =>
      apiPatch<AdminAchievementView>(`/admin/achievements/${code}`, data),
    ['admin', 'achievements'],
  );

export const useGamificationSettings = () =>
  useQuery({
    queryKey: ['admin', 'gamification-settings'],
    queryFn: ({ signal }) =>
      apiGet<GamificationSettingsView>('/admin/gamification/settings', { signal }),
  });

export const useUpdateGamificationSettings = () =>
  useInvalidating(
    (data: UpdateGamificationSettingsRequest) =>
      apiPatch<GamificationSettingsView>('/admin/gamification/settings', data),
    ['admin', 'gamification-settings'],
  );

// --- Configurações clínicas -----------------------------------------------------

export const useClinicalSettings = () =>
  useQuery({
    queryKey: ['admin', 'clinical-settings'],
    queryFn: ({ signal }) => apiGet<ClinicalSettingsView>('/clinical-settings', { signal }),
  });

export const useUpdateClinicalSettings = () =>
  useInvalidating(
    (data: UpdateClinicalSettingsRequest) =>
      apiPatch<ClinicalSettingsView>('/clinical-settings', data),
    ['admin', 'clinical-settings'],
  );

export const useScreeningConfig = () =>
  useQuery({
    queryKey: ['admin', 'screening-config'],
    queryFn: ({ signal }) => apiGet<ScreeningConfigView>('/screening-config', { signal }),
  });

export const useUpdateQuestion = () =>
  useInvalidating(
    ({ id, ...data }: UpdateQuestionRequest & { id: string }) =>
      apiPatch(`/screening-config/questions/${id}`, data),
    ['admin', 'screening-config'],
  );

export const useUpdateRule = () =>
  useInvalidating(
    ({ id, ...data }: UpdateScreeningRuleRequest & { id: string }) =>
      apiPatch(`/screening-config/rules/${id}`, data),
    ['admin', 'screening-config'],
  );

export const useScreeningFieldsAdmin = () =>
  useQuery({
    queryKey: ['admin', 'screening-fields'],
    queryFn: ({ signal }) => apiGet<ScreeningFieldView[]>('/screening-config/fields', { signal }),
  });

export const useSaveScreeningField = () =>
  useInvalidating(
    ({ id, ...data }: Partial<ScreeningFieldInput> & { id?: string }) =>
      id
        ? apiPatch<ScreeningFieldView>(`/screening-config/fields/${id}`, data)
        : apiPost<ScreeningFieldView>('/screening-config/fields', data),
    ['admin', 'screening-fields'],
  );

// --- Auditoria -------------------------------------------------------------------

export function useAuditLogs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return useQuery({
    queryKey: ['admin', 'audit', query],
    queryFn: ({ signal }) => apiGet<AuditLogsResponse>(`/audit-logs?${query}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

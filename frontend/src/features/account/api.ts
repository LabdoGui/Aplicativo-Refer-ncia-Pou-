import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangePasswordRequest,
  ConsentView,
  MeResponse,
  PersonalDataExport,
  UpdateConsentsRequest,
  UpdateMeRequest,
} from '@pulso/contracts';
import { patchSessionUser, refreshSession } from '@/features/auth/session-store';
import { apiGet, apiPatch, apiPut, apiRequest } from '@/lib/api';

export const accountKeys = {
  me: ['account', 'me'] as const,
  consents: ['account', 'consents'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: accountKeys.me,
    queryFn: ({ signal }) => apiGet<MeResponse>('/users/me', { signal }),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMeRequest) => apiPatch<MeResponse>('/users/me', data),
    onSuccess: (me) => {
      queryClient.setQueryData(accountKeys.me, me);
      // Cabeçalho e saudação mostram o nome novo na hora; a renovação traz um
      // token com o nome atualizado para os demais serviços.
      patchSessionUser({ name: me.name });
      void refreshSession();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => apiPatch<void>('/users/me/password', data),
  });
}

export function useConsents() {
  return useQuery({
    queryKey: accountKeys.consents,
    queryFn: ({ signal }) => apiGet<ConsentView[]>('/consents/me', { signal }),
  });
}

export function useUpdateConsents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateConsentsRequest) => apiPut<ConsentView[]>('/consents/me', data),
    onSuccess: (consents) => queryClient.setQueryData(accountKeys.consents, consents),
  });
}

export function exportPersonalData(): Promise<PersonalDataExport> {
  return apiGet<PersonalDataExport>('/users/me/export');
}

export function deleteAccount(password: string): Promise<void> {
  return apiRequest<void>('/users/me', { method: 'DELETE', body: { password } });
}

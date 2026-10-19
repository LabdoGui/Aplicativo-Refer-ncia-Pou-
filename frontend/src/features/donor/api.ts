import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  type AppointmentView,
  type AvailabilityResponse,
  type CampaignView,
  type CreateAppointmentRequest,
  type DocumentType,
  type DocumentView,
  type DonorAttendanceView,
  type EligibilityView,
  type GamificationProfile,
  type InstitutionView,
  type MyHoursResponse,
  type PreScreeningQuestionnaire,
  type PreScreeningResultView,
  type PreScreeningSubmitRequest,
  type PublicStockLevel,
  type RankingOptInRequest,
  type RankingResponse,
  type RescheduleAppointmentRequest,
  type UnitView,
} from '@pulso/contracts';
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';

export const donorKeys = {
  appointments: ['donor', 'appointments'] as const,
  appointment: (id: string) => ['donor', 'appointments', id] as const,
  eligibility: ['donor', 'eligibility'] as const,
  profile: ['donor', 'gamification'] as const,
  ranking: ['donor', 'ranking'] as const,
  preScreening: ['prescreening', 'latest'] as const,
  questionnaire: ['prescreening', 'questionnaire'] as const,
  history: ['donor', 'history'] as const,
  attendance: (id: string) => ['donor', 'history', id] as const,
  documents: ['donor', 'documents'] as const,
  hours: ['donor', 'hours'] as const,
};

export const publicKeys = {
  units: ['public', 'units'] as const,
  campaigns: ['public', 'campaigns'] as const,
  stock: ['public', 'stock'] as const,
  institutions: ['public', 'institutions'] as const,
  availability: (unitId: string, from: string, to: string) =>
    ['public', 'availability', unitId, from, to] as const,
};

// --- Consultas públicas -------------------------------------------------------

export const useUnits = () =>
  useQuery({
    queryKey: publicKeys.units,
    queryFn: ({ signal }) => apiGet<UnitView[]>('/units', { signal }),
  });

export const useCampaigns = () =>
  useQuery({
    queryKey: publicKeys.campaigns,
    queryFn: ({ signal }) => apiGet<CampaignView[]>('/campaigns', { signal }),
  });

export const usePublicStock = () =>
  useQuery({
    queryKey: publicKeys.stock,
    queryFn: ({ signal }) => apiGet<PublicStockLevel[]>('/blood-inventory/public', { signal }),
    staleTime: 60_000,
  });

export const useInstitutions = () =>
  useQuery({
    queryKey: publicKeys.institutions,
    queryFn: ({ signal }) => apiGet<InstitutionView[]>('/institutions', { signal }),
  });

export function useAvailability(unitId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: publicKeys.availability(unitId ?? '', from, to),
    queryFn: ({ signal }) =>
      apiGet<AvailabilityResponse>(
        `/appointments/availability?unitId=${unitId}&from=${from}&to=${to}`,
        { signal },
      ),
    enabled: Boolean(unitId),
    staleTime: 15_000,
  });
}

// --- Agendamentos -------------------------------------------------------------

export const useMyAppointments = () =>
  useQuery({
    queryKey: donorKeys.appointments,
    queryFn: ({ signal }) => apiGet<AppointmentView[]>('/appointments/me', { signal }),
  });

export function activeAppointment(
  appointments: AppointmentView[] | undefined,
): AppointmentView | undefined {
  return appointments?.find((appointment) =>
    ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status),
  );
}

export const useAppointment = (id: string) =>
  useQuery({
    queryKey: donorKeys.appointment(id),
    queryFn: ({ signal }) => apiGet<AppointmentView>(`/appointments/${id}`, { signal }),
  });

function useAppointmentMutation<V>(fn: (variables: V) => Promise<AppointmentView>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (appointment) => {
      queryClient.setQueryData(donorKeys.appointment(appointment.id), appointment);
      void queryClient.invalidateQueries({ queryKey: donorKeys.appointments });
      void queryClient.invalidateQueries({ queryKey: ['public', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export const useCreateAppointment = () =>
  useAppointmentMutation((data: CreateAppointmentRequest) =>
    apiPost<AppointmentView>('/appointments', data),
  );

export const useCancelAppointment = () =>
  useAppointmentMutation(({ id, reason }: { id: string; reason?: string }) =>
    apiPatch<AppointmentView>(`/appointments/${id}/cancel`, { reason }),
  );

export const useRescheduleAppointment = () =>
  useAppointmentMutation(({ id, ...data }: RescheduleAppointmentRequest & { id: string }) =>
    apiPatch<AppointmentView>(`/appointments/${id}/reschedule`, data),
  );

// --- Pré-triagem --------------------------------------------------------------

export const useLatestPreScreening = () =>
  useQuery({
    queryKey: donorKeys.preScreening,
    queryFn: ({ signal }) =>
      apiGet<PreScreeningResultView | undefined>('/screenings/pre-check/me/latest', {
        signal,
      }).then((d) => d ?? null),
  });

export const useQuestionnaire = () =>
  useQuery({
    queryKey: donorKeys.questionnaire,
    queryFn: ({ signal }) =>
      apiGet<PreScreeningQuestionnaire>('/screenings/questionnaire', { signal }),
    staleTime: 5 * 60_000,
  });

export function useSubmitPreScreening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PreScreeningSubmitRequest) =>
      apiPost<PreScreeningResultView>('/screenings/pre-check', data),
    onSuccess: (result) => {
      queryClient.setQueryData(donorKeys.preScreening, result);
      // A data informativa também considera a pré-triagem válida (RN04).
      void queryClient.invalidateQueries({ queryKey: donorKeys.eligibility });
    },
  });
}

// --- Doações, elegibilidade e documentos --------------------------------------

export const useEligibility = () =>
  useQuery({
    queryKey: donorKeys.eligibility,
    queryFn: ({ signal }) => apiGet<EligibilityView>('/donations/eligibility', { signal }),
  });

export const useDonationHistory = () =>
  useQuery({
    queryKey: donorKeys.history,
    queryFn: ({ signal }) => apiGet<DonorAttendanceView[]>('/donations/history', { signal }),
  });

export const useAttendance = (id: string) =>
  useQuery({
    queryKey: donorKeys.attendance(id),
    queryFn: ({ signal }) => apiGet<DonorAttendanceView>(`/donations/history/${id}`, { signal }),
  });

export const useDocuments = () =>
  useQuery({
    queryKey: donorKeys.documents,
    queryFn: ({ signal }) => apiGet<DocumentView[]>('/documents/me', { signal }),
  });

export function useIssueDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { attendanceId: string; type: DocumentType }) =>
      apiPost<DocumentView>('/documents', data),
    onSuccess: (_document, variables) => {
      void queryClient.invalidateQueries({ queryKey: donorKeys.documents });
      void queryClient.invalidateQueries({
        queryKey: donorKeys.attendance(variables.attendanceId),
      });
      void queryClient.invalidateQueries({ queryKey: donorKeys.history });
    },
  });
}

// --- Gamificação e horas --------------------------------------------------------

export const useGamificationProfile = () =>
  useQuery({
    queryKey: donorKeys.profile,
    queryFn: ({ signal }) => apiGet<GamificationProfile>('/gamification/profile', { signal }),
  });

export const useRanking = (enabled: boolean) =>
  useQuery({
    queryKey: donorKeys.ranking,
    queryFn: ({ signal }) => apiGet<RankingResponse>('/gamification/ranking', { signal }),
    enabled,
  });

export function useRankingOptIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RankingOptInRequest) =>
      apiPut<GamificationProfile>('/gamification/ranking/opt-in', data),
    onSuccess: (profile) => {
      queryClient.setQueryData(donorKeys.profile, profile);
      void queryClient.invalidateQueries({ queryKey: donorKeys.ranking });
    },
  });
}

export const useMyHours = () =>
  useQuery({
    queryKey: donorKeys.hours,
    queryFn: ({ signal }) => apiGet<MyHoursResponse>('/complementary-hours/me', { signal }),
  });

export function useSetInstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (institutionId: string | null) =>
      apiPut<MyHoursResponse>('/complementary-hours/institution', { institutionId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: donorKeys.hours }),
  });
}

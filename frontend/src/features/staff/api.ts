import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AgendaResponse,
  AttendanceStaffView,
  ProfessionalScreeningRequest,
  RecordDonationRequest,
  ScreeningFieldView,
  SharedPreScreeningView,
  StaffAppointmentView,
  UnitView,
} from '@pulso/contracts';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

export const staffKeys = {
  units: ['staff', 'units'] as const,
  agenda: (unitId: string, date: string) => ['staff', 'agenda', unitId, date] as const,
  appointment: (id: string) => ['staff', 'appointment', id] as const,
  attendance: (appointmentId: string) => ['staff', 'attendance', appointmentId] as const,
  preScreening: (appointmentId: string) => ['staff', 'prescreening', appointmentId] as const,
  fields: ['staff', 'fields'] as const,
};

/** 204 (sem conteúdo) vira null. */
const orNull = <T>(value: T | undefined): T | null => value ?? null;

export const useUnits = () =>
  useQuery({
    queryKey: staffKeys.units,
    queryFn: ({ signal }) => apiGet<UnitView[]>('/units', { signal }),
  });

export function useAgenda(unitId: string | undefined, date: string) {
  return useQuery({
    queryKey: staffKeys.agenda(unitId ?? '', date),
    queryFn: ({ signal }) =>
      apiGet<AgendaResponse>(`/agenda?unitId=${unitId}&date=${date}`, { signal }),
    enabled: Boolean(unitId),
    refetchInterval: 60_000,
  });
}

export const useStaffAppointment = (id: string) =>
  useQuery({
    queryKey: staffKeys.appointment(id),
    queryFn: ({ signal }) => apiGet<StaffAppointmentView>(`/agenda/appointments/${id}`, { signal }),
  });

export const useAttendance = (appointmentId: string, enabled: boolean) =>
  useQuery({
    queryKey: staffKeys.attendance(appointmentId),
    queryFn: ({ signal }) =>
      apiGet<AttendanceStaffView | undefined>(`/attendances/appointment/${appointmentId}`, {
        signal,
      }).then(orNull),
    enabled,
  });

export const useSharedPreScreening = (appointmentId: string, enabled: boolean) =>
  useQuery({
    queryKey: staffKeys.preScreening(appointmentId),
    queryFn: ({ signal }) =>
      apiGet<SharedPreScreeningView | undefined>(
        `/attendances/appointment/${appointmentId}/pre-screening`,
        {
          signal,
        },
      ).then(orNull),
    enabled,
    retry: false,
  });

export const useScreeningFields = (enabled: boolean) =>
  useQuery({
    queryKey: staffKeys.fields,
    queryFn: ({ signal }) => apiGet<ScreeningFieldView[]>('/attendances/fields', { signal }),
    enabled,
    staleTime: 5 * 60_000,
  });

/** Atualiza a agenda e o detalhe depois de uma mudança de situação. */
function useRefreshAppointment() {
  const queryClient = useQueryClient();
  return (appointment: StaffAppointmentView) => {
    queryClient.setQueryData(staffKeys.appointment(appointment.appointmentId), appointment);
    void queryClient.invalidateQueries({ queryKey: ['staff', 'agenda'] });
  };
}

export function useCheckIn() {
  const refresh = useRefreshAppointment();
  return useMutation({
    mutationFn: (id: string) => apiPatch<StaffAppointmentView>(`/appointments/${id}/check-in`),
    onSuccess: refresh,
  });
}

export function useNoShow() {
  const refresh = useRefreshAppointment();
  return useMutation({
    mutationFn: (id: string) => apiPatch<StaffAppointmentView>(`/appointments/${id}/no-show`),
    onSuccess: refresh,
  });
}

function useAttendanceMutation<V>(fn: (variables: V) => Promise<AttendanceStaffView>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (attendance) => {
      if (attendance.appointmentId) {
        queryClient.setQueryData(staffKeys.attendance(attendance.appointmentId), attendance);
        // A agenda passa a "Concluído" quando o scheduling consome o evento do atendimento.
        void queryClient.invalidateQueries({
          queryKey: staffKeys.appointment(attendance.appointmentId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['staff', 'agenda'] });
    },
  });
}

export const useRecordScreening = () =>
  useAttendanceMutation((data: ProfessionalScreeningRequest) =>
    apiPost<AttendanceStaffView>('/attendances', data),
  );

export const useRecordDonation = () =>
  useAttendanceMutation((data: RecordDonationRequest) =>
    apiPost<AttendanceStaffView>('/donations', data),
  );

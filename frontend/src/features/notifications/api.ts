import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationView, Paginated, UnreadCountResponse } from '@pulso/contracts';
import { apiGet, apiPatch } from '@/lib/api';
import { useSession } from '@/features/auth/use-auth';

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread-count'] as const,
  list: (onlyUnread: boolean, page: number) => ['notifications', 'list', onlyUnread, page] as const,
};

/** Contador de não lidas, atualizado a cada minuto enquanto houver sessão. */
export function useUnreadCount() {
  const { status } = useSession();
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => apiGet<UnreadCountResponse>('/notifications/unread-count', { signal }),
    enabled: status === 'authenticated',
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications(onlyUnread: boolean, page: number) {
  return useQuery({
    queryKey: notificationKeys.list(onlyUnread, page),
    queryFn: ({ signal }) =>
      apiGet<Paginated<NotificationView>>(
        `/notifications?onlyUnread=${onlyUnread}&page=${page}&pageSize=20`,
        { signal },
      ),
    placeholderData: (previous) => previous,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<NotificationView>(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPatch<{ count: number }>('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

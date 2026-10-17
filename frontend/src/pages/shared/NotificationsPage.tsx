import { useState } from 'react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NotificationView } from '@pulso/contracts';
import { Button, EmptyState, PageHeader, QueryState, SegmentedControl } from '@/components/ui';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/features/notifications/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Central de notificações (doador, equipe e administração). */
export function NotificationsPage() {
  useDocumentTitle('Notificações');
  const navigate = useNavigate();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [page, setPage] = useState(1);
  const list = useNotifications(onlyUnread, page);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  function open(notification: NotificationView) {
    if (!notification.readAt) markRead.mutate(notification.id);
    if (notification.link) navigate(notification.link);
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        actions={
          <Button
            variant="outline"
            size="sm"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck aria-hidden="true" className="size-4" /> Marcar todas como lidas
          </Button>
        }
      />
      <div className="mb-4">
        <SegmentedControl
          label="Filtro"
          value={onlyUnread ? 'unread' : 'all'}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'unread', label: 'Não lidas' },
          ]}
          onChange={(value) => {
            setOnlyUnread(value === 'unread');
            setPage(1);
          }}
        />
      </div>
      <QueryState
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        loadingLabel="Carregando notificações…"
      >
        {list.data && list.data.items.length === 0 ? (
          <EmptyState
            icon={onlyUnread ? BellOff : Bell}
            title={onlyUnread ? 'Nada novo por aqui' : 'Nenhuma notificação ainda'}
            description="Avisos de agendamentos, doações e conquistas aparecem aqui."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {list.data?.items.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className="flex w-full gap-3 px-4 py-4 text-left hover:bg-canvas sm:px-5"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-2 size-2.5 shrink-0 rounded-full',
                      notification.readAt ? 'bg-transparent' : 'bg-carmim-700',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-ink', !notification.readAt && 'font-semibold')}>
                      {notification.title}
                      {!notification.readAt && <span className="sr-only"> (não lida)</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-muted">{notification.body}</span>
                    <span className="mt-1 block text-xs text-ink-muted">
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anteriores
            </Button>
            <span className="text-sm text-ink-muted">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próximas
            </Button>
          </nav>
        )}
      </QueryState>
    </>
  );
}

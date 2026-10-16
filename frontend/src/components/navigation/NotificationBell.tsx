import { Bell } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

/**
 * Espaço reservado para a central de notificações.
 * Fase 12: exibir o contador de não lidas (GET /notifications/unread-count).
 * Por enquanto leva à página "Em construção", sem números fictícios.
 */
export function NotificationBell({ to }: { to: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'grid size-11 place-items-center rounded-full transition-colors',
          isActive
            ? 'bg-petroleo-50 text-petroleo-800'
            : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        )
      }
    >
      <Bell aria-hidden="true" className="size-5" strokeWidth={1.75} />
      <span className="sr-only">Notificações</span>
    </NavLink>
  );
}

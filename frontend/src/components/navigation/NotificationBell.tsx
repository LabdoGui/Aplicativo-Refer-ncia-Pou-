import { Bell } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useUnreadCount } from '@/features/notifications/api';
import { cn } from '@/lib/cn';

/** Sino da central de notificações, com o número de não lidas. */
export function NotificationBell({ to }: { to: string }) {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;
  const label =
    count > 0 ? `Notificações: ${count} não lida${count > 1 ? 's' : ''}` : 'Notificações';
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative grid size-11 place-items-center rounded-full transition-colors',
          isActive
            ? 'bg-petroleo-50 text-petroleo-800'
            : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        )
      }
    >
      <Bell aria-hidden="true" className="size-5" strokeWidth={1.75} />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 grid min-w-5 place-items-center rounded-full bg-carmim-700 px-1 text-[0.6875rem] leading-5 font-bold text-white"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </NavLink>
  );
}

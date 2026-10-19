import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import type { NavItem } from './types';

interface SideNavListProps {
  items: readonly NavItem[];
  /** "dark" para a barra lateral petróleo da equipe e da administração. */
  tone?: 'light' | 'dark';
  /** Chamado ao escolher um item (ex.: fechar o menu lateral no celular). */
  onNavigate?: () => void;
}

const TONES = {
  light: {
    idle: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
    active: 'bg-petroleo-50 text-petroleo-800',
    marker: 'bg-petroleo-700',
  },
  dark: {
    idle: 'text-petroleo-100 hover:bg-white/10 hover:text-white',
    active: 'bg-white/12 text-white',
    marker: 'bg-carmim-300',
  },
} as const;

/** Lista vertical de navegação; o NavLink marca o item atual com aria-current="page". */
export function SideNavList({ items, tone = 'light', onNavigate }: SideNavListProps) {
  const styles = TONES[tone];
  return (
    <ul className="space-y-1">
      {items.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'relative flex min-h-11 items-center gap-3 rounded-control px-3 text-[0.9375rem] transition-colors',
                isActive ? cn(styles.active, 'font-semibold') : cn(styles.idle, 'font-medium'),
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className={cn('absolute inset-y-2 left-0 w-1 rounded-full', styles.marker)}
                  />
                )}
                <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

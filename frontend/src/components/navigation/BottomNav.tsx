import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import type { NavItem } from './types';

interface BottomNavProps {
  items: readonly NavItem[];
  label: string;
  className?: string;
}

/** Navegação inferior do celular: ícone + rótulo sempre visível, alvo de toque ≥ 44 px. */
export function BottomNav({ items, label, className }: BottomNavProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur',
        className,
      )}
    >
      <ul
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ to, label: itemLabel, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition-colors',
                  isActive
                    ? 'font-semibold text-petroleo-800'
                    : 'font-medium text-ink-muted hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-8 w-14 place-items-center rounded-full transition-colors',
                      isActive && 'bg-petroleo-50',
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-[1.375rem]"
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                  </span>
                  {/*
                   * Rótulo com a largura toda da coluna (sem padding lateral). Abaixo de 360 px
                   * (docs/03, RNF20) a fonte fica um pouco menor e mais justa, para que
                   * "Conquistas" caiba também em 320 px; o truncate é só uma rede de segurança.
                   */}
                  <span className="max-w-full truncate text-[0.6875rem] tracking-tight min-[360px]:text-xs min-[360px]:tracking-normal">
                    {itemLabel}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

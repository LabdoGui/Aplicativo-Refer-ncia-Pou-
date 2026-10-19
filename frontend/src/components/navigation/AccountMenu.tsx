import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '@pulso/contracts';
import { logout, useSession } from '@/features/auth/use-auth';
import { cn } from '@/lib/cn';

interface AccountMenuProps {
  links?: ReadonlyArray<{ to: string; label: string }>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

/** Menu da conta no topo das áreas logadas: nome, papel, atalhos e "Sair". */
export function AccountMenu({ links = [] }: AccountMenuProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  async function handleLogout() {
    setLeaving(true);
    try {
      await logout();
    } finally {
      navigate('/entrar', { replace: true });
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-full py-1 pr-2 pl-1 text-ink hover:bg-surface-muted"
      >
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-full bg-petroleo-700 text-sm font-semibold text-white"
        >
          {initials(user.name)}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">{user.name}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
        <span className="sr-only">Menu da conta</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 z-40 mt-2 w-64 rounded-card border border-line bg-surface p-2 shadow-raised"
      >
        <div className="border-b border-line px-3 pt-2 pb-3">
          <p className="truncate font-semibold text-ink">{user.name}</p>
          <p className="truncate text-sm text-ink-muted">{user.email}</p>
          <p className="mt-1 text-xs font-semibold tracking-wide text-petroleo-700 uppercase">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
        <ul className="py-1">
          {links.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={handleLogout}
              disabled={leaving}
              className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-semibold text-critical-strong hover:bg-critical-soft"
            >
              <LogOut aria-hidden="true" className="size-4" />
              {leaving ? 'Saindo…' : 'Sair'}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

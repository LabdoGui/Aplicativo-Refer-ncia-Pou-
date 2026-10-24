import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { ACADEMIC_NOTICE } from '../shared/notices';

const FOOTER_LINKS = [
  { to: '/#como-funciona', label: 'Como funciona' },
  { to: '/privacidade', label: 'Privacidade e consentimento' },
  { to: '/status', label: 'Status do sistema' },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-page flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo size="sm" />
          <p className="text-sm text-ink-muted">
            Conectando doadores a vidas que precisam de ajuda.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            {FOOTER_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-page px-4 py-5 text-sm text-ink-muted sm:px-6">
          {ACADEMIC_NOTICE}
        </p>
      </div>
    </footer>
  );
}

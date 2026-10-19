import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonStyles } from '@/components/ui';

/** Link de volta para a lista (acima do título da página). */
export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className={buttonStyles({ variant: 'ghost', size: 'sm', className: '-ml-3 mb-4' })}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

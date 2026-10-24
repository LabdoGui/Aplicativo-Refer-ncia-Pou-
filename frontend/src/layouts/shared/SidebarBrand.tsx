import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';

interface SidebarBrandProps {
  areaLabel: string;
  homePath: string;
  onNavigate?: () => void;
}

/** Logotipo branco + nome da área, no topo da barra lateral petróleo. */
export function SidebarBrand({ areaLabel, homePath, onNavigate }: SidebarBrandProps) {
  return (
    <div className="px-3 pt-5 pb-3">
      <Link
        to={homePath}
        onClick={onNavigate}
        aria-label={`SangueConecta — início: ${areaLabel}`}
        className="inline-flex rounded-control"
      >
        <Logo tone="white" />
      </Link>
      <p className="mt-2 text-xs font-semibold tracking-wider text-petroleo-200 uppercase">
        {areaLabel}
      </p>
    </div>
  );
}

import { ADMIN_NAV } from '@/app/navigation';
import { WorkspaceLayout } from './WorkspaceLayout';

/** Área administrativa (/admin). */
export function AdminLayout() {
  return (
    <WorkspaceLayout
      areaLabel="Administração"
      homePath="/admin"
      items={ADMIN_NAV}
      notificationsPath="/admin/notificacoes"
    />
  );
}

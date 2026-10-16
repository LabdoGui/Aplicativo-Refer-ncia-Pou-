import { STAFF_NAV } from '@/app/navigation';
import { WorkspaceLayout } from './WorkspaceLayout';

/** Área da equipe (/equipe): colaboradores e enfermeiros. */
export function StaffLayout() {
  return <WorkspaceLayout areaLabel="Área da equipe" homePath="/equipe" items={STAFF_NAV} />;
}

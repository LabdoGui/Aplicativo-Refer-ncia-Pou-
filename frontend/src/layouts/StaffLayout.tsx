import { STAFF_NAV } from '@/app/navigation';
import { WorkspaceLayout } from './WorkspaceLayout';

/**
 * Área da equipe (/equipe): colaboradores e enfermeiros. Sem central de
 * notificações: nenhum aviso do sistema é destinado à equipe.
 */
export function StaffLayout() {
  return <WorkspaceLayout areaLabel="Área da equipe" homePath="/equipe" items={STAFF_NAV} />;
}

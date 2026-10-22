/**
 * Módulo scheduling da demonstração (espelho do scheduling-service): unidades,
 * grade, bloqueios, disponibilidade, agendamentos, agenda da equipe e campanhas.
 */
import { registerAgendaRoutes } from './agenda';
import { registerAppointmentRoutes } from './appointments';
import { registerCampaignRoutes } from './campaigns';
import { registerIntegration } from './integration';
import { startJobs } from './jobs';
import { registerUnitRoutes } from './units';

export type { SchedulingState } from './model';
export { seedScheduling } from './seed';

export function registerScheduling(): void {
  registerUnitRoutes();
  registerAppointmentRoutes();
  registerAgendaRoutes();
  registerCampaignRoutes();
  registerIntegration();
  // Agendamentos vencidos e lembretes: ao abrir e depois periodicamente.
  startJobs();
}

/**
 * Chamadas entre serviços (no back-end real, rotas /api/v1/internal/** com token
 * interno). Cada módulo preenche a sua parte ao registrar-se; os consumidores
 * chamam por aqui, sem importar o módulo dono do dado.
 */
import type {
  ClinicalStats,
  DonorSummary,
  EngagementStats,
  IdentityStats,
  InternalAppointmentView,
  InventoryStats,
  Role,
  SchedulingStats,
  StatsFilters,
} from '@pulso/contracts';

export interface InternalApi {
  identity: {
    /** GET /internal/donors/summaries?ids=... */
    donorSummaries(ids: string[]): DonorSummary[];
    /** GET /internal/users/communications-consent?ids=... */
    communicationsConsent(ids: string[]): { granted: string[] };
    /** GET /internal/users?role=... (contas ativas) */
    usersByRole(role: Role): Array<{ id: string }>;
    /** GET /internal/stats */
    stats(filters: StatsFilters): IdentityStats;
  };
  scheduling: {
    /** GET /internal/appointments/:id (lança 404 como o back-end se não existir) */
    appointment(id: string): InternalAppointmentView;
    stats(filters: StatsFilters): SchedulingStats;
  };
  clinical: { stats(filters: StatsFilters): ClinicalStats };
  inventory: { stats(filters: StatsFilters): InventoryStats };
  engagement: { stats(filters: StatsFilters): EngagementStats };
}

const notReady = (name: string) => () => {
  throw new Error(`[demo] internal.${name} ainda não registrado`);
};

export const internal: InternalApi = {
  identity: {
    donorSummaries: notReady('identity.donorSummaries'),
    communicationsConsent: notReady('identity.communicationsConsent'),
    usersByRole: notReady('identity.usersByRole'),
    stats: notReady('identity.stats'),
  },
  scheduling: {
    appointment: notReady('scheduling.appointment'),
    stats: notReady('scheduling.stats'),
  },
  clinical: { stats: notReady('clinical.stats') },
  inventory: { stats: notReady('inventory.stats') },
  engagement: { stats: notReady('engagement.stats') },
};

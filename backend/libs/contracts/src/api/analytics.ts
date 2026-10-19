import type {
  AppointmentStatus,
  BloodType,
  PreScreeningResult,
  ScreeningResult,
  StockStatus,
} from '../domain';
import type { PublicStockLevel } from './inventory';

/** Filtros do dashboard e dos relatórios (datas AAAA-MM-DD, inclusivas, fuso America/Sao_Paulo). */
export interface StatsFilters {
  from: string;
  to: string;
  unitId?: string;
  bloodType?: BloodType;
}

export interface DailyCount {
  date: string;
  count: number;
}

// --- Estatísticas internas de cada serviço (GET /internal/stats) -----------

export interface IdentityStats {
  donorsTotal: number;
  donorsNewInPeriod: number;
  newDonorsByDay: DailyCount[];
  staffTotal: number;
}

export interface SchedulingStats {
  appointmentsTotal: number;
  byStatus: Record<AppointmentStatus, number>;
  byDay: DailyCount[];
  /** Comparecimentos ÷ (comparecimentos + faltas) no período; null sem dados. */
  attendanceRate: number | null;
  upcoming: number;
  activeUnits: number;
}

export interface ClinicalStats {
  donationsCompleted: number;
  donationsNotCompleted: number;
  attendances: number;
  volumeMl: number;
  byDay: DailyCount[];
  byMonth: Array<{ month: string; count: number }>;
  byBloodType: Array<{ bloodType: BloodType; count: number }>;
  byUnit: Array<{ unitId: string; unitName: string; count: number }>;
  screeningOutcomes: Array<{ result: ScreeningResult; count: number }>;
  preScreenings: Array<{ result: PreScreeningResult; count: number }>;
}

export interface InventoryStats {
  totalBags: number;
  byStatus: Record<StockStatus, number>;
  levels: Array<{ bloodType: BloodType; quantity: number; status: StockStatus }>;
  movementsIn: number;
  movementsOut: number;
}

export interface EngagementStats {
  pointsAwarded: number;
  achievementsUnlocked: number;
  hoursPending: number;
  hoursApproved: number;
  rankingParticipants: number;
  levels: Array<{ code: string; name: string; count: number }>;
}

// --- Composição no gateway --------------------------------------------------

export interface DashboardStatistics {
  filters: StatsFilters;
  generatedAt: string;
  identity: IdentityStats | null;
  scheduling: SchedulingStats | null;
  clinical: ClinicalStats | null;
  inventory: InventoryStats | null;
  engagement: EngagementStats | null;
  /** Serviços que não responderam: o painel mostra o restante (degradação parcial). */
  unavailable: string[];
}

export interface PublicStats {
  donationsLast30Days: number | null;
  activeUnits: number | null;
  donorsRegistered: number | null;
  stock: PublicStockLevel[];
  generatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  service: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: string;
}

export interface AuditLogsQuery {
  service?: string;
  from?: string;
  to?: string;
  action?: string;
  limit?: number;
}

export interface AuditLogsResponse {
  items: AuditLogEntry[];
  unavailable: string[];
}

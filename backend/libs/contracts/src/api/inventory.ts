import type { BloodType, MovementReason, MovementType, StockStatus } from '../domain';

export interface StockTrend {
  /** Diferença de bolsas em relação a 7 dias atrás. */
  delta7d: number;
  deltaPercent7d: number | null;
  direction: 'UP' | 'DOWN' | 'STABLE';
}

export interface StockItemView {
  bloodType: BloodType;
  quantity: number;
  minimum: number;
  ideal: number;
  status: StockStatus;
  trend: StockTrend;
  /** Saldo no fim de cada um dos últimos 14 dias (o último é hoje). */
  sparkline: number[];
  updatedAt: string;
}

export interface StockOverview {
  items: StockItemView[];
  totals: { quantity: number; critical: number; attention: number; normal: number };
  updatedAt: string;
}

export interface PublicStockLevel {
  bloodType: BloodType;
  status: StockStatus;
}

export interface CreateMovementRequest {
  bloodType: BloodType;
  type: MovementType;
  quantity: number;
  reason: MovementReason;
  notes?: string;
  /** Data e hora da movimentação (padrão: agora). Não pode ser futura. */
  occurredAt?: string;
}

export interface MovementView {
  id: string;
  bloodType: BloodType;
  type: MovementType;
  quantity: number;
  reason: MovementReason;
  notes: string | null;
  occurredAt: string;
  responsibleName: string;
  balanceAfter: number;
  createdAt: string;
}

export interface MovementsQuery {
  bloodType?: BloodType;
  type?: MovementType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface StockHistoryPoint {
  date: string;
  total: number;
  values: Record<BloodType, number>;
}

export interface StockHistoryResponse {
  days: number;
  points: StockHistoryPoint[];
}

export interface UpdateThresholdsRequest {
  minimum: number;
  ideal: number;
}

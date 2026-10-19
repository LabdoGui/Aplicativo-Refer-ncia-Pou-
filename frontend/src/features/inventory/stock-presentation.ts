import type { StatusTone } from '@/components/ui';
import type { StockStatus } from '@pulso/contracts';

export const STOCK_TONE: Record<StockStatus, StatusTone> = {
  NORMAL: 'ok',
  ATTENTION: 'warn',
  CRITICAL: 'critical',
};

export const bags = (value: number) => `${value} ${value === 1 ? 'bolsa' : 'bolsas'}`;

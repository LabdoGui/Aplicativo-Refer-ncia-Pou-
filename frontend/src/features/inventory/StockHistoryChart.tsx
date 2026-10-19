import { useState } from 'react';
import { BLOOD_TYPES, BLOOD_TYPE_LABELS, type BloodType } from '@pulso/contracts';
import { SelectField } from '@/components/form';
import { QueryState, SegmentedControl } from '@/components/ui';
import { ChartCard } from '@/features/insights/charts/ChartCard';
import { TimeSeriesChart } from '@/features/insights/charts/TimeSeriesChart';
import { formatNumber } from '@/lib/format';
import { useStockHistory } from './api';

const DAY_OPTIONS = [
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' },
] as const;

/** Saldo no fim de cada dia, do total ou de um tipo (uma série por vez). */
export function StockHistoryChart() {
  const [days, setDays] = useState<'30' | '60' | '90'>('30');
  const [type, setType] = useState<BloodType | ''>('');
  const history = useStockHistory(Number(days));
  const points = (history.data?.points ?? []).map((point) => ({
    date: point.date,
    value: type ? point.values[type] : point.total,
  }));
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  const subject = type ? `do tipo ${BLOOD_TYPE_LABELS[type]}` : 'total';
  const summary =
    first !== undefined && last !== undefined
      ? `Estoque ${subject}: de ${formatNumber(first)} para ${formatNumber(last)} bolsas em ${days} dias.`
      : 'Sem histórico no período.';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <SelectField
          label="Série"
          className="w-60"
          value={type}
          onChange={(event) => setType(event.target.value as BloodType | '')}
          options={[
            { value: '', label: 'Total (todos os tipos)' },
            ...BLOOD_TYPES.map((t) => ({ value: t, label: `Tipo ${BLOOD_TYPE_LABELS[t]}` })),
          ]}
        />
        <SegmentedControl
          label="Período do histórico"
          value={days}
          options={DAY_OPTIONS}
          onChange={setDays}
        />
      </div>
      <QueryState
        isLoading={history.isLoading}
        error={history.error}
        onRetry={() => history.refetch()}
      >
        <ChartCard
          title={`Histórico do estoque ${subject}`}
          summary={summary}
          rows={points.map((p) => ({
            label: p.date.split('-').reverse().join('/'),
            value: p.value,
          }))}
          columns={['Dia', 'Bolsas']}
        >
          <TimeSeriesChart points={points} unit="bolsas" height={260} />
        </ChartCard>
      </QueryState>
    </div>
  );
}

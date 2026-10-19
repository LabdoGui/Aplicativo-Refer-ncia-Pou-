import {
  APPOINTMENT_STATUS_LABELS,
  BLOOD_TYPE_LABELS,
  SCREENING_RESULT_LABELS,
  type AppointmentStatus,
  type DashboardStatistics,
} from '@pulso/contracts';
import { formatNumber } from '@/lib/format';
import { CategoryBarChart } from './charts/CategoryBarChart';
import { ChartCard, type ChartRow } from './charts/ChartCard';
import { TimeSeriesChart } from './charts/TimeSeriesChart';

const sum = (rows: ChartRow[]) => rows.reduce((total, row) => total + row.value, 0);

function topSummary(rows: ChartRow[], noun: string): string {
  if (rows.length === 0 || sum(rows) === 0) return `Nenhum registro de ${noun} no período.`;
  const top = [...rows].sort((a, b) => b.value - a.value)[0];
  return `${formatNumber(sum(rows))} no total; maior valor: ${top.label} (${formatNumber(top.value)}).`;
}

/** Gráficos do painel (cada um com resumo em texto e tabela). */
export function DashboardCharts({ stats }: { stats: DashboardStatistics }) {
  const { clinical, scheduling } = stats;
  const byDay = (clinical?.byDay ?? []).map((d) => ({ date: d.date, value: d.count }));
  const byDayRows = byDay.map((d) => ({
    label: d.date.split('-').reverse().join('/'),
    value: d.value,
  }));
  const byType = (clinical?.byBloodType ?? []).map((d) => ({
    label: BLOOD_TYPE_LABELS[d.bloodType],
    value: d.count,
  }));
  const byUnit = (clinical?.byUnit ?? []).map((d) => ({ label: d.unitName, value: d.count }));
  const byStatus = scheduling
    ? (Object.entries(scheduling.byStatus) as Array<[AppointmentStatus, number]>)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({ label: APPOINTMENT_STATUS_LABELS[status], value: count }))
    : [];
  const outcomes = (clinical?.screeningOutcomes ?? []).map((d) => ({
    label: SCREENING_RESULT_LABELS[d.result],
    value: d.count,
  }));
  const peak = [...byDay].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        className="lg:col-span-2"
        title="Doações concluídas por dia"
        summary={
          clinical
            ? `${formatNumber(clinical.donationsCompleted)} doações no período${peak && peak.value > 0 ? `; pico de ${formatNumber(peak.value)} em ${peak.date.split('-').reverse().join('/')}` : ''}.`
            : 'Serviço clínico indisponível.'
        }
        rows={byDayRows}
        columns={['Dia', 'Doações']}
      >
        <TimeSeriesChart points={byDay} unit="doações" />
      </ChartCard>
      <ChartCard
        title="Doações por tipo sanguíneo"
        summary={topSummary(byType, 'doações')}
        rows={byType}
        columns={['Tipo', 'Doações']}
      >
        <CategoryBarChart rows={byType} unit="doações" />
      </ChartCard>
      <ChartCard
        title="Doações por unidade"
        summary={topSummary(byUnit, 'doações')}
        rows={byUnit}
        columns={['Unidade', 'Doações']}
      >
        <CategoryBarChart rows={byUnit} unit="doações" />
      </ChartCard>
      <ChartCard
        title="Agendamentos por situação"
        summary={topSummary(byStatus, 'agendamentos')}
        rows={byStatus}
        columns={['Situação', 'Agendamentos']}
      >
        <CategoryBarChart rows={byStatus} unit="agendamentos" />
      </ChartCard>
      <ChartCard
        title="Resultado da triagem"
        summary={topSummary(outcomes, 'triagens')}
        rows={outcomes}
        columns={['Resultado', 'Atendimentos']}
      >
        <CategoryBarChart rows={outcomes} unit="atendimentos" />
      </ChartCard>
    </div>
  );
}

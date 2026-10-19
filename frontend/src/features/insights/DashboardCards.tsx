import { CalendarCheck, Droplet, Droplets, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DashboardStatistics } from '@pulso/contracts';
import { StatCard } from '@/components/ui';
import { formatNumber } from '@/lib/format';

const num = (value: number | null | undefined) =>
  value === null || value === undefined ? null : formatNumber(value);

/** Indicadores do período. "—" quando o serviço da informação não respondeu. */
export function DashboardCards({ stats }: { stats: DashboardStatistics }) {
  const { identity, scheduling, clinical, inventory, engagement } = stats;
  const rate = scheduling?.attendanceRate;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        label="Doadores cadastrados"
        icon={Users}
        value={num(identity?.donorsTotal)}
        hint={
          identity ? `${formatNumber(identity.donorsNewInPeriod)} novos no período` : 'Indisponível'
        }
      />
      <StatCard
        label="Agendamentos no período"
        icon={CalendarCheck}
        value={num(scheduling?.appointmentsTotal)}
        hint={
          scheduling
            ? rate === null || rate === undefined
              ? 'Sem comparecimentos para calcular a taxa'
              : `${formatNumber(rate * 100, { maximumFractionDigits: 0 })}% de comparecimento`
            : 'Indisponível'
        }
      />
      <StatCard
        label="Doações concluídas"
        icon={Droplet}
        value={num(clinical?.donationsCompleted)}
        hint={
          clinical
            ? `${formatNumber(clinical.volumeMl / 1000, { maximumFractionDigits: 1 })} L coletados`
            : 'Indisponível'
        }
      />
      <StatCard
        label="Tipos em estado crítico"
        icon={Droplets}
        value={num(inventory?.byStatus.CRITICAL)}
        hint={
          inventory ? (
            <Link to="/admin/estoque" className="font-semibold text-petroleo-700 hover:underline">
              {formatNumber(inventory.byStatus.ATTENTION)} em atenção · ver Banco de Sangue
            </Link>
          ) : (
            'Indisponível'
          )
        }
      />
      <StatCard
        label="Pontos concedidos"
        icon={Trophy}
        value={num(engagement?.pointsAwarded)}
        hint={
          engagement
            ? `${formatNumber(engagement.achievementsUnlocked)} conquistas · ${formatNumber(engagement.hoursPending)} h pendentes`
            : 'Indisponível'
        }
      />
    </div>
  );
}

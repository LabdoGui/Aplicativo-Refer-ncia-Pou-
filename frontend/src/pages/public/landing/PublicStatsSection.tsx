import { FlaskConical } from 'lucide-react';
import {
  BLOOD_TYPE_LABELS,
  STOCK_STATUS_LABELS,
  type PublicStats,
  type StockStatus,
} from '@pulso/contracts';
import { Badge, Button, Card, Spinner, StatusPill, type StatusTone } from '@/components/ui';
import { usePublicStats } from '@/features/public/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { SectionHeading } from './SectionHeading';

const STOCK_TONE: Record<StockStatus, StatusTone> = {
  NORMAL: 'ok',
  ATTENTION: 'warn',
  CRITICAL: 'critical',
};

/** Situação do estoque por tipo e números gerais, vindos da API (dados fictícios). */
export function PublicStatsSection() {
  const stats = usePublicStats();
  return (
    <section aria-labelledby="estoques-agora">
      <div className="mx-auto max-w-page px-4 pb-16 sm:px-6 lg:pb-20">
        <Card className="sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <SectionHeading
              id="estoques-agora"
              eyebrow="Estoques agora"
              title="Como está o estoque de sangue"
            />
            <Badge
              tone="info"
              className="self-start"
              icon={<FlaskConical aria-hidden="true" className="size-3.5" />}
            >
              Dados fictícios de demonstração
            </Badge>
          </div>
          <div aria-live="polite" className="mt-8">
            {stats.isLoading ? (
              <Spinner label="Carregando a situação dos estoques…" className="text-ink-muted" />
            ) : stats.error || !stats.data ? (
              <div className="flex flex-wrap items-center gap-3 text-ink-muted">
                <p>Não foi possível carregar os números agora.</p>
                <Button variant="ghost" size="sm" onClick={() => stats.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <StatsContent data={stats.data} />
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function StatsContent({ data }: { data: PublicStats }) {
  const numbers = [
    { label: 'Doações nos últimos 30 dias', value: data.donationsLast30Days },
    { label: 'Unidades de coleta ativas', value: data.activeUnits },
    { label: 'Doadores cadastrados', value: data.donorsRegistered },
  ];
  return (
    <>
      {data.stock.length > 0 ? (
        <ul
          aria-label="Situação do estoque por tipo sanguíneo"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {data.stock.map((item) => (
            <li
              key={item.bloodType}
              className="flex flex-col items-start gap-2 rounded-control border border-line bg-canvas px-4 py-3"
            >
              <span className="font-display text-2xl font-bold text-ink">
                <span className="sr-only">Tipo </span>
                {BLOOD_TYPE_LABELS[item.bloodType]}
              </span>
              <StatusPill
                status={STOCK_TONE[item.status]}
                label={STOCK_STATUS_LABELS[item.status]}
                size="sm"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">A situação do estoque está indisponível no momento.</p>
      )}

      <dl className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
        {numbers.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm font-medium text-ink-muted">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-bold text-ink tabular-nums">
              {value === null ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">Indisponível no momento</span>
                </>
              ) : (
                formatNumber(value)
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-sm text-ink-muted">
        Mostramos só a situação de cada tipo, não as quantidades. Atualizado em{' '}
        {formatDateTime(data.generatedAt)}.
      </p>
    </>
  );
}

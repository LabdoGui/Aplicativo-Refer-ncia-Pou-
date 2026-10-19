import { useState } from 'react';
import { Building2, ChevronRight, MapPin, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, EmptyState, PageHeader, QueryState } from '@/components/ui';
import { useAllUnits } from '@/features/admin/units';
import { UnitDialog } from '@/features/admin-ops/UnitDialog';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Unidades de coleta: dados, situação e acesso à grade de horários. */
export function UnitsPage() {
  useDocumentTitle('Unidades');
  const units = useAllUnits();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title="Unidades"
        description="Locais de coleta, com grade semanal de horários e bloqueios."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" /> Nova unidade
          </Button>
        }
      />
      <QueryState isLoading={units.isLoading} error={units.error} onRetry={() => units.refetch()}>
        {units.data && units.data.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhuma unidade cadastrada" />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {units.data?.map((unit) => (
              <li key={unit.id}>
                <Link
                  to={`/admin/unidades/${unit.id}`}
                  className="flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-petroleo-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold text-ink">{unit.name}</h2>
                    <Badge tone={unit.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                      {unit.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  <p className="mt-2 flex gap-2 text-sm text-ink-muted">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {unit.address} · {unit.district}, {unit.city}/{unit.state}
                  </p>
                  {unit.openingHours && (
                    <p className="mt-1 text-sm text-ink-muted">{unit.openingHours}</p>
                  )}
                  <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-petroleo-700">
                    Grade e bloqueios <ChevronRight aria-hidden="true" className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <UnitDialog
        open={creating}
        unit={null}
        onClose={() => setCreating(false)}
        onSaved={(unit) => navigate(`/admin/unidades/${unit.id}`)}
      />
    </>
  );
}

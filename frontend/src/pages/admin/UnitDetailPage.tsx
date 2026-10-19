import { useState } from 'react';
import { ArrowLeft, MapPin, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, PageHeader, QueryState } from '@/components/ui';
import { useUnit } from '@/features/admin-ops/api';
import { BlocksPanel } from '@/features/admin-ops/BlocksPanel';
import { ScheduleRulesEditor } from '@/features/admin-ops/ScheduleRulesEditor';
import { UnitDialog } from '@/features/admin-ops/UnitDialog';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Detalhe da unidade: dados, grade semanal e bloqueios. */
export function UnitDetailPage() {
  const { unitId = '' } = useParams();
  const unit = useUnit(unitId);
  useDocumentTitle(unit.data?.name ?? 'Unidade');
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Link
        to="/admin/unidades"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-petroleo-700 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Unidades
      </Link>
      <QueryState isLoading={unit.isLoading} error={unit.error} onRetry={() => unit.refetch()}>
        {unit.data && (
          <>
            <PageHeader
              title={unit.data.name}
              actions={
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" /> Editar dados
                </Button>
              }
            />
            <div className="space-y-6">
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex gap-2 text-sm text-ink">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-petroleo-700" />
                  {unit.data.address} · {unit.data.district}, {unit.data.city}/{unit.data.state}
                  {unit.data.phone && ` · ${unit.data.phone}`}
                </p>
                <Badge tone={unit.data.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                  {unit.data.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                </Badge>
              </Card>
              <ScheduleRulesEditor unitId={unitId} />
              <BlocksPanel unitId={unitId} />
            </div>
            <UnitDialog open={editing} unit={unit.data} onClose={() => setEditing(false)} />
          </>
        )}
      </QueryState>
    </>
  );
}

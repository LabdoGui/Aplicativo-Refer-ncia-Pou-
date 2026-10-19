import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { InstitutionView } from '@pulso/contracts';
import { CheckboxField, TextField } from '@/components/form';
import {
  Badge,
  Button,
  Dialog,
  ProblemAlert,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { useAdminInstitutions, useSaveInstitution } from './api';

/** Instituições de ensino parceiras (fictícias) e horas por doação de cada uma. */
export function InstitutionsTab() {
  const institutions = useAdminInstitutions();
  const [editing, setEditing] = useState<{ open: boolean; item: InstitutionView | null }>({
    open: false,
    item: null,
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ open: true, item: null })}>
          <Plus aria-hidden="true" className="size-4" /> Nova instituição
        </Button>
      </div>
      <QueryState
        isLoading={institutions.isLoading}
        error={institutions.error}
        onRetry={() => institutions.refetch()}
      >
        <Table caption="Instituições parceiras">
          <THead>
            <Tr>
              <Th>Instituição</Th>
              <Th className="text-right">Horas por doação</Th>
              <Th>Situação</Th>
              <Th className="text-right">Ação</Th>
            </Tr>
          </THead>
          <TBody>
            {institutions.data?.map((item) => (
              <Tr key={item.id}>
                <Td className="font-semibold">{item.name}</Td>
                <Td className="text-right tabular-nums">{item.hoursPerDonation} h</Td>
                <Td>
                  <Badge tone={item.active ? 'ok' : 'neutral'}>
                    {item.active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing({ open: true, item })}
                    aria-label={`Editar ${item.name}`}
                  >
                    Editar
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </QueryState>
      {editing.open && (
        <InstitutionDialog
          item={editing.item}
          onClose={() => setEditing({ open: false, item: null })}
        />
      )}
    </div>
  );
}

function InstitutionDialog({
  item,
  onClose,
}: {
  item: InstitutionView | null;
  onClose: () => void;
}) {
  const save = useSaveInstitution();
  const [form, setForm] = useState({
    name: item?.name ?? '',
    hours: String(item?.hoursPerDonation ?? 4),
    active: item?.active ?? true,
  });
  const hours = Number(form.hours);
  const invalid =
    form.name.trim().length < 3 || !Number.isInteger(hours) || hours < 1 || hours > 40;
  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? 'Editar instituição' : 'Nova instituição'}
      description="A quantidade de horas por doação é regra da instituição de ensino."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={invalid}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: item?.id,
                  name: form.name.trim(),
                  hoursPerDonation: hours,
                  active: form.active,
                },
                { onSuccess: onClose },
              )
            }
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Nome"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <TextField
          label="Horas por doação"
          hint="De 1 a 40."
          inputMode="numeric"
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
        />
        <CheckboxField
          label="Instituição ativa"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        <ProblemAlert error={save.error} />
      </div>
    </Dialog>
  );
}

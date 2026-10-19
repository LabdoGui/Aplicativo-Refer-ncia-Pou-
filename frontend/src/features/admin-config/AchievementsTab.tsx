import { useState } from 'react';
import type { AdminAchievementView } from '@pulso/contracts';
import { CheckboxField, TextAreaField, TextField } from '@/components/form';
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
import { formatNumber } from '@/lib/format';
import { useAdminAchievements, useUpdateAchievement } from './api';

const criteriaText = (item: AdminAchievementView) =>
  item.criteria === 'DONATION_COUNT'
    ? `${item.threshold} doação(ões) concluída(s)`
    : 'Doação concluída em campanha';

/** Conquistas: nome, descrição e ativação (o critério é fixo). */
export function AchievementsTab() {
  const achievements = useAdminAchievements();
  const [editing, setEditing] = useState<AdminAchievementView | null>(null);
  return (
    <QueryState
      isLoading={achievements.isLoading}
      error={achievements.error}
      onRetry={() => achievements.refetch()}
    >
      <Table caption="Conquistas">
        <THead>
          <Tr>
            <Th>Conquista</Th>
            <Th>Critério</Th>
            <Th className="text-right">Desbloqueios</Th>
            <Th>Situação</Th>
            <Th className="text-right">Ação</Th>
          </Tr>
        </THead>
        <TBody>
          {achievements.data?.map((item) => (
            <Tr key={item.code}>
              <Td>
                <span className="block font-semibold">{item.name}</span>
                <span className="text-xs text-ink-muted">{item.description}</span>
              </Td>
              <Td>{criteriaText(item)}</Td>
              <Td className="text-right tabular-nums">{formatNumber(item.unlockedCount)}</Td>
              <Td>
                <Badge tone={item.active ? 'ok' : 'neutral'}>
                  {item.active ? 'Ativa' : 'Inativa'}
                </Badge>
              </Td>
              <Td className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(item)}
                  aria-label={`Editar ${item.name}`}
                >
                  Editar
                </Button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      {editing && <AchievementDialog item={editing} onClose={() => setEditing(null)} />}
    </QueryState>
  );
}

function AchievementDialog({ item, onClose }: { item: AdminAchievementView; onClose: () => void }) {
  const update = useUpdateAchievement();
  const [form, setForm] = useState({
    name: item.name,
    description: item.description,
    active: item.active,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Editar conquista"
      description={`Critério: ${criteriaText(item)}. Desativar não remove conquistas já desbloqueadas.`}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={update.isPending}
            disabled={form.name.trim().length < 3 || form.description.trim().length < 3}
            onClick={() =>
              update.mutate(
                {
                  code: item.code,
                  name: form.name.trim(),
                  description: form.description.trim(),
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
          value={form.name}
          maxLength={60}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <TextAreaField
          label="Descrição"
          value={form.description}
          maxLength={200}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <CheckboxField
          label="Conquista ativa"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        <ProblemAlert error={update.error} />
      </div>
    </Dialog>
  );
}

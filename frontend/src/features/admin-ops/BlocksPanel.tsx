import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { TextField } from '@/components/form';
import { Button, Card, ProblemAlert, QueryState } from '@/components/ui';
import { localInputToIso } from '@/lib/datetime-local';
import { formatDateTime } from '@/lib/format';
import { useBlocks, useCreateBlock, useDeleteBlock } from './api';

/** Bloqueios de agenda (feriado, manutenção…): impedem novas reservas no período. */
export function BlocksPanel({ unitId }: { unitId: string }) {
  const blocks = useBlocks(unitId);
  const create = useCreateBlock(unitId);
  const remove = useDeleteBlock(unitId);
  const [form, setForm] = useState({ startsAt: '', endsAt: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function submit() {
    setError(null);
    setNotice(null);
    if (!form.startsAt || !form.endsAt || form.reason.trim().length < 3) {
      setError('Preencha início, fim e o motivo (mínimo de 3 caracteres).');
      return;
    }
    if (form.endsAt <= form.startsAt) {
      setError('O fim precisa ser depois do início.');
      return;
    }
    create.mutate(
      {
        startsAt: localInputToIso(form.startsAt),
        endsAt: localInputToIso(form.endsAt),
        reason: form.reason.trim(),
      },
      {
        onSuccess: (block) => {
          setForm({ startsAt: '', endsAt: '', reason: '' });
          const cancelled = block.cancelledAppointments ?? 0;
          setNotice(
            cancelled === 0
              ? 'Bloqueio criado. Não havia agendamentos no período.'
              : `Bloqueio criado. ${cancelled} ${cancelled === 1 ? 'agendamento foi cancelado' : 'agendamentos foram cancelados'} e os doadores foram avisados.`,
          );
        },
      },
    );
  }

  return (
    <Card as="section" aria-labelledby="bloqueios-titulo">
      <h2 id="bloqueios-titulo" className="text-lg font-bold text-ink">
        Bloqueios
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Um bloqueio impede novas reservas. Agendamentos já marcados no período são cancelados e os
        doadores recebem um aviso.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
        <TextField
          label="Início"
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
        />
        <TextField
          label="Fim"
          type="datetime-local"
          value={form.endsAt}
          onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
        />
        <TextField
          label="Motivo"
          maxLength={200}
          placeholder="Ex.: manutenção"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        <Button variant="secondary" loading={create.isPending} onClick={submit}>
          Bloquear
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-critical-strong">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2 text-sm font-medium text-ok-strong">
          {notice}
        </p>
      )}
      <ProblemAlert error={create.error ?? remove.error} className="mt-3" />
      <QueryState
        isLoading={blocks.isLoading}
        error={blocks.error}
        onRetry={() => blocks.refetch()}
      >
        {blocks.data && blocks.data.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Nenhum bloqueio futuro.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {blocks.data?.map((block) => (
              <li
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  <span className="font-semibold text-ink">
                    {formatDateTime(block.startsAt)} – {formatDateTime(block.endsAt)}
                  </span>
                  <span className="block text-ink-muted">{block.reason}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={remove.isPending && remove.variables === block.id}
                  onClick={() => remove.mutate(block.id)}
                  aria-label={`Remover bloqueio: ${block.reason}`}
                >
                  <Trash2 aria-hidden="true" className="size-4" /> Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </Card>
  );
}

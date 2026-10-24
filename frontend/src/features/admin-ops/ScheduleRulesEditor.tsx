import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ScheduleRuleInput } from '@pulso/contracts';
import { Alert, Button, Card, ProblemAlert, QueryState } from '@/components/ui';
import { controlStyles } from '@/components/form';
import { useReplaceRules, useScheduleRules } from './api';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const NEW_RULE: ScheduleRuleInput = {
  weekday: 1,
  startTime: '08:00',
  endTime: '12:00',
  slotMinutes: 30,
  capacity: 2,
  active: true,
};

/** Grade semanal (hora local da unidade). Salvar substitui a grade inteira. */
export function ScheduleRulesEditor({ unitId }: { unitId: string }) {
  const rules = useScheduleRules(unitId);
  const replace = useReplaceRules(unitId);
  const [draft, setDraft] = useState<ScheduleRuleInput[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (rules.data)
      setDraft(
        rules.data
          .map(({ id: _id, ...rule }) => rule)
          .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
      );
  }, [rules.data]);

  const change = (index: number, patch: Partial<ScheduleRuleInput>) => {
    setSaved(false);
    setDraft((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  return (
    <Card as="section" aria-labelledby="grade-titulo">
      <h2 id="grade-titulo" className="text-lg font-bold text-ink">
        Grade semanal
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Cada linha gera horários a cada intervalo, com a capacidade por horário. Mudanças valem para
        novas reservas.
      </p>
      <QueryState isLoading={rules.isLoading} error={rules.error} onRetry={() => rules.refetch()}>
        {/* relative: os rótulos sr-only das células ficam presos à rolagem horizontal. */}
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">Regras da grade semanal</caption>
            <thead className="text-left text-xs tracking-wide text-ink-muted uppercase">
              <tr>
                <th className="py-2 pr-2">Dia</th>
                <th className="py-2 pr-2">Início</th>
                <th className="py-2 pr-2">Fim</th>
                <th className="py-2 pr-2">Intervalo (min)</th>
                <th className="py-2 pr-2">Vagas por horário</th>
                <th className="py-2 pr-2">Ativa</th>
                <th className="py-2">
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.map((rule, index) => (
                <tr key={index} className="border-t border-line">
                  <td className="py-2 pr-2">
                    <select
                      aria-label={`Dia da linha ${index + 1}`}
                      className={controlStyles(false)}
                      value={rule.weekday}
                      onChange={(e) => change(index, { weekday: Number(e.target.value) })}
                    >
                      {WEEKDAYS.map((day, i) => (
                        <option key={day} value={i + 1}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Início da linha ${index + 1}`}
                      type="time"
                      className={controlStyles(false)}
                      value={rule.startTime}
                      onChange={(e) => change(index, { startTime: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Fim da linha ${index + 1}`}
                      type="time"
                      className={controlStyles(false)}
                      value={rule.endTime}
                      onChange={(e) => change(index, { endTime: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Intervalo da linha ${index + 1}`}
                      type="number"
                      min={10}
                      max={120}
                      step={5}
                      className={controlStyles(false)}
                      value={rule.slotMinutes}
                      onChange={(e) => change(index, { slotMinutes: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Vagas da linha ${index + 1}`}
                      type="number"
                      min={1}
                      max={50}
                      className={controlStyles(false)}
                      value={rule.capacity}
                      onChange={(e) => change(index, { capacity: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Linha ${index + 1} ativa`}
                      type="checkbox"
                      className="size-5 accent-petroleo-700"
                      checked={rule.active}
                      onChange={(e) => change(index, { active: e.target.checked })}
                    />
                  </td>
                  <td className="py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover linha ${index + 1}`}
                      onClick={() => setDraft((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {draft.length === 0 && (
          <p className="py-4 text-sm text-ink-muted">
            Sem regras: a unidade não terá horários para agendar.
          </p>
        )}
        <div className="mt-4 space-y-3">
          <ProblemAlert error={replace.error} />
          <div aria-live="polite">{saved && <Alert tone="ok">Grade salva.</Alert>}</div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setDraft((current) => [...current, { ...NEW_RULE }])}
            >
              <Plus aria-hidden="true" className="size-4" /> Adicionar linha
            </Button>
            <Button
              loading={replace.isPending}
              onClick={() => replace.mutate({ rules: draft }, { onSuccess: () => setSaved(true) })}
            >
              Salvar grade
            </Button>
          </div>
        </div>
      </QueryState>
    </Card>
  );
}

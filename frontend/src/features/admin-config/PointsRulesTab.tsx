import { useEffect, useState } from 'react';
import { POINTS_BASES, type GamificationSettingsView, type PointsBasis } from '@pulso/contracts';
import { CheckboxField, TextField } from '@/components/form';
import { Alert, Button, Card, ProblemAlert, QueryState } from '@/components/ui';
import { useGamificationSettings, useUpdateGamificationSettings } from './api';

const BASIS_TEXT: Record<PointsBasis, { title: string; description: string }> = {
  ATTENDANCE: {
    title: 'Por comparecimento (recomendado)',
    description:
      'Pontos ao comparecer para doar, mesmo que a doação não aconteça naquele dia. Não pune quem foi considerado inapto.',
  },
  DONATION: {
    title: 'Só por doação concluída',
    description: 'Pontos apenas quando a coleta é registrada como concluída.',
  },
};

/** Regras de pontuação (D4). Valem para os próximos atendimentos; não há prêmios materiais (RN13). */
export function PointsRulesTab() {
  const settings = useGamificationSettings();
  const update = useUpdateGamificationSettings();
  const [form, setForm] = useState<GamificationSettingsView | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const points = (value: number) => Number.isInteger(value) && value >= 0 && value <= 1000;
  const valid =
    form && points(form.firstPoints) && points(form.recurringPoints) && points(form.campaignPoints);

  return (
    <QueryState
      isLoading={settings.isLoading}
      error={settings.error}
      onRetry={() => settings.refetch()}
    >
      {form && (
        <Card className="max-w-3xl space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Base dos pontos</legend>
            <div className="mt-2 space-y-2">
              {POINTS_BASES.map((basis) => (
                <label
                  key={basis}
                  className="flex cursor-pointer gap-3 rounded-control border border-line p-3 has-[:checked]:border-petroleo-700 has-[:checked]:bg-petroleo-50"
                >
                  <input
                    type="radio"
                    name="pointsBasis"
                    className="mt-1 size-4 accent-petroleo-700"
                    checked={form.pointsBasis === basis}
                    onChange={() => {
                      setSaved(false);
                      setForm({ ...form, pointsBasis: basis });
                    }}
                  />
                  <span>
                    <span className="block font-semibold text-ink">{BASIS_TEXT[basis].title}</span>
                    <span className="text-sm text-ink-muted">{BASIS_TEXT[basis].description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['firstPoints', 'Primeira vez'],
                ['recurringPoints', 'Vezes seguintes'],
                ['campaignPoints', 'Bônus de campanha'],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={`${label} (pontos)`}
                inputMode="numeric"
                value={String(form[key])}
                error={points(form[key]) ? undefined : 'Use de 0 a 1000.'}
                onChange={(e) => {
                  setSaved(false);
                  setForm({ ...form, [key]: Number(e.target.value) });
                }}
              />
            ))}
          </div>
          <CheckboxField
            label="Ranking ativado"
            description="Mostra os doadores que aceitaram participar, só com apelido."
            checked={form.rankingEnabled}
            onChange={(e) => {
              setSaved(false);
              setForm({ ...form, rankingEnabled: e.target.checked });
            }}
          />
          <Alert tone="info">
            As mudanças valem para os próximos atendimentos; pontos já concedidos não são
            recalculados. Não há prêmios materiais.
          </Alert>
          <ProblemAlert error={update.error} />
          <div aria-live="polite">{saved && <Alert tone="ok">Regras salvas.</Alert>}</div>
          <Button
            disabled={!valid}
            loading={update.isPending}
            onClick={() => update.mutate(form, { onSuccess: () => setSaved(true) })}
          >
            Salvar regras
          </Button>
        </Card>
      )}
    </QueryState>
  );
}

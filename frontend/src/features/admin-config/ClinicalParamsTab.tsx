import { useEffect, useState } from 'react';
import { VALIDATION_STATUS_LABELS } from '@pulso/contracts';
import { TextField } from '@/components/form';
import { Alert, Badge, Button, Card, ProblemAlert, QueryState } from '@/components/ui';
import { useClinicalSettings, useUpdateClinicalSettings } from './api';

/** Intervalo entre doações (D7, valor de demonstração) e validade da pré-triagem. */
export function ClinicalParamsTab() {
  const settings = useClinicalSettings();
  const update = useUpdateClinicalSettings();
  const [form, setForm] = useState({ interval: '', validity: '' });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (settings.data)
      setForm({
        interval: String(settings.data.donationIntervalDays),
        validity: String(settings.data.preScreeningValidityDays),
      });
  }, [settings.data]);
  const interval = Number(form.interval);
  const validity = Number(form.validity);
  const intervalOk = Number.isInteger(interval) && interval >= 30 && interval <= 365;
  const validityOk = Number.isInteger(validity) && validity >= 1 && validity <= 90;

  return (
    <QueryState
      isLoading={settings.isLoading}
      error={settings.error}
      onRetry={() => settings.refetch()}
    >
      {settings.data && (
        <Card className="max-w-2xl space-y-5">
          <div className="space-y-2">
            <TextField
              label="Intervalo entre doações (dias)"
              inputMode="numeric"
              value={form.interval}
              error={intervalOk ? undefined : 'Use de 30 a 365 dias.'}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, interval: e.target.value });
              }}
            />
            <Badge tone="warn">
              {VALIDATION_STATUS_LABELS[settings.data.intervalValidationStatus]}
            </Badge>
            <p className="text-sm text-ink-muted">
              Valor de demonstração. Calcula só a data informativa mostrada ao doador; nunca impede
              o agendamento. Precisa ser definido por profissionais de saúde da instituição.
            </p>
          </div>
          <TextField
            label="Validade da pré-triagem (dias)"
            inputMode="numeric"
            value={form.validity}
            error={validityOk ? undefined : 'Use de 1 a 90 dias.'}
            hint="Depois disso, o doador é convidado a responder de novo."
            onChange={(e) => {
              setSaved(false);
              setForm({ ...form, validity: e.target.value });
            }}
          />
          <ProblemAlert error={update.error} />
          <div aria-live="polite">{saved && <Alert tone="ok">Parâmetros salvos.</Alert>}</div>
          <Button
            disabled={!intervalOk || !validityOk}
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { donationIntervalDays: interval, preScreeningValidityDays: validity },
                { onSuccess: () => setSaved(true) },
              )
            }
          >
            Salvar parâmetros
          </Button>
        </Card>
      )}
    </QueryState>
  );
}

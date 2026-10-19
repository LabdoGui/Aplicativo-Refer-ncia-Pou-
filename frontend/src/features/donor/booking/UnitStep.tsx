import { Clock, Megaphone } from 'lucide-react';
import type { UnitView } from '@pulso/contracts';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

interface UnitStepProps {
  units: UnitView[];
  value: string | undefined;
  onChange: (unitId: string) => void;
  error?: string;
  /** Unidade da campanha escolhida (destaque informativo). */
  campaignUnitId?: string;
  /** Unidade do agendamento atual (reagendamento). */
  currentUnitId?: string;
}

/** Unidades como cartões selecionáveis (grupo de rádio). */
export function UnitStep({
  units,
  value,
  onChange,
  error,
  campaignUnitId,
  currentUnitId,
}: UnitStepProps) {
  return (
    <fieldset aria-describedby={error ? 'unidade-erro' : undefined}>
      <legend className="sr-only">Unidades de coleta</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {units.map((unit) => {
          const checked = unit.id === value;
          return (
            <label
              key={unit.id}
              className={cn(
                'flex cursor-pointer gap-3 rounded-card border bg-surface p-4 transition-colors',
                checked
                  ? 'border-petroleo-700 bg-petroleo-50 ring-1 ring-petroleo-700'
                  : 'border-line hover:border-petroleo-300',
              )}
            >
              <input
                type="radio"
                name="unidade"
                value={unit.id}
                checked={checked}
                onChange={() => onChange(unit.id)}
                className="mt-0.5 size-5 shrink-0 accent-petroleo-700"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{unit.name}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">
                  {unit.address} · {unit.district}, {unit.city}
                </span>
                {unit.openingHours && (
                  <span className="mt-2 flex items-start gap-1.5 text-sm text-ink">
                    <Clock
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-petroleo-700"
                    />
                    {unit.openingHours}
                  </span>
                )}
                {(unit.id === campaignUnitId || unit.id === currentUnitId) && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {unit.id === campaignUnitId && (
                      <Badge
                        tone="brand"
                        icon={<Megaphone aria-hidden="true" className="size-3.5" />}
                      >
                        Unidade da campanha
                      </Badge>
                    )}
                    {unit.id === currentUnitId && <Badge tone="info">Unidade atual</Badge>}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id="unidade-erro" role="alert" className="mt-3 text-sm font-medium text-critical-strong">
          {error}
        </p>
      )}
    </fieldset>
  );
}

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { UnitView } from '@pulso/contracts';
import { SelectField, TextField } from '@/components/form';
import { Button } from '@/components/ui';
import { addDaysIso, formatLongDate, todayIso } from '@/lib/format';

interface AgendaToolbarProps {
  units: UnitView[];
  unitId: string | undefined;
  date: string;
  onChange: (next: { unitId?: string; date?: string }) => void;
}

/** Unidade e dia da agenda, com atalhos para o dia anterior, hoje e o próximo. */
export function AgendaToolbar({ units, unitId, date, onChange }: AgendaToolbarProps) {
  const isToday = date === todayIso();
  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:flex-row md:items-end">
      {units.length > 1 && (
        <SelectField
          label="Unidade"
          className="md:w-72"
          value={unitId ?? ''}
          onChange={(event) => onChange({ unitId: event.target.value })}
          options={units.map((unit) => ({ value: unit.id, label: unit.name }))}
        />
      )}
      <TextField
        label="Dia"
        type="date"
        className="md:w-48"
        value={date}
        onChange={(event) => event.target.value && onChange({ date: event.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ date: addDaysIso(date, -1) })}
        >
          <ChevronLeft aria-hidden="true" className="size-4" /> Dia anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isToday}
          onClick={() => onChange({ date: todayIso() })}
        >
          Hoje
        </Button>
        <Button variant="outline" size="sm" onClick={() => onChange({ date: addDaysIso(date, 1) })}>
          Próximo dia <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <p className="text-sm font-semibold text-ink md:ml-auto md:pb-3" aria-live="polite">
        {isToday ? 'Hoje, ' : ''}
        {formatLongDate(date)}
      </p>
    </div>
  );
}

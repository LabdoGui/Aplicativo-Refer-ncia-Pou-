import { BLOOD_TYPES, BLOOD_TYPE_LABELS } from '@pulso/contracts';
import { SelectField, TextField } from '@/components/form';
import { SegmentedControl } from '@/components/ui';
import { FilterBar } from '@/features/admin/FilterBar';
import { unitOptions, useAllUnits } from '@/features/admin/units';
import { formatDate } from '@/lib/format';
import { PERIOD_PRESETS, type useStatsFilters } from './use-stats-filters';

type FiltersState = ReturnType<typeof useStatsFilters>;

/** Período, unidade e tipo sanguíneo: valem para tudo o que está abaixo. */
export function StatsFilterBar({
  state,
  showBloodType = true,
}: {
  state: FiltersState;
  showBloodType?: boolean;
}) {
  const units = useAllUnits();
  const { filters, preset, set } = state;
  return (
    <FilterBar>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink">Período</p>
        <SegmentedControl
          label="Período"
          value={preset}
          options={PERIOD_PRESETS}
          onChange={(value) =>
            set(
              value === 'custom'
                ? { periodo: value, de: filters.from, ate: filters.to }
                : { periodo: value, de: undefined, ate: undefined },
            )
          }
        />
      </div>
      {preset === 'custom' && (
        <>
          <TextField
            label="De"
            type="date"
            className="w-40"
            value={filters.from}
            max={filters.to}
            onChange={(e) => e.target.value && set({ de: e.target.value })}
          />
          <TextField
            label="Até"
            type="date"
            className="w-40"
            value={filters.to}
            min={filters.from}
            onChange={(e) => e.target.value && set({ ate: e.target.value })}
          />
        </>
      )}
      <SelectField
        label="Unidade"
        className="w-60"
        placeholder="Todas as unidades"
        options={unitOptions(units.data)}
        value={filters.unitId ?? ''}
        onChange={(e) => set({ unidade: e.target.value || undefined })}
      />
      {showBloodType && (
        <SelectField
          label="Tipo sanguíneo"
          className="w-44"
          placeholder="Todos"
          options={BLOOD_TYPES.map((type) => ({ value: type, label: BLOOD_TYPE_LABELS[type] }))}
          value={filters.bloodType ?? ''}
          onChange={(e) => set({ tipo: e.target.value || undefined })}
        />
      )}
      <p className="pb-3 text-sm text-ink-muted" aria-live="polite">
        {formatDate(filters.from)} a {formatDate(filters.to)}
      </p>
    </FilterBar>
  );
}

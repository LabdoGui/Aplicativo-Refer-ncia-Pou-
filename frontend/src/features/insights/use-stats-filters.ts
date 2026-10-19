import { useSearchParams } from 'react-router-dom';
import { BLOOD_TYPES, type BloodType, type StatsFilters } from '@pulso/contracts';
import { addDaysIso, todayIso } from '@/lib/format';

export const PERIOD_PRESETS = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '365', label: '12 meses' },
  { value: 'custom', label: 'Personalizado' },
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]['value'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros do painel e dos relatórios na URL (compartilháveis e preservados ao recarregar). */
export function useStatsFilters(defaultPreset: PeriodPreset = '30') {
  const [params, setParams] = useSearchParams();
  const preset = (PERIOD_PRESETS.find((p) => p.value === params.get('periodo'))?.value ??
    defaultPreset) as PeriodPreset;
  const today = todayIso();
  const customFrom = params.get('de');
  const customTo = params.get('ate');
  const days = preset === 'custom' ? 30 : Number(preset);
  let from = addDaysIso(today, -(days - 1));
  let to = today;
  if (
    preset === 'custom' &&
    customFrom &&
    customTo &&
    ISO_DATE.test(customFrom) &&
    ISO_DATE.test(customTo)
  ) {
    from = customFrom <= customTo ? customFrom : customTo;
    to = customFrom <= customTo ? customTo : customFrom;
  }
  const unitId = params.get('unidade') ?? undefined;
  const requestedType = params.get('tipo');
  const bloodType = BLOOD_TYPES.includes(requestedType as BloodType)
    ? (requestedType as BloodType)
    : undefined;
  const filters: StatsFilters = { from, to, unitId, bloodType };

  function set(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  return { filters, preset, set };
}

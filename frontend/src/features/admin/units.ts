import { useQuery } from '@tanstack/react-query';
import type { UnitView } from '@pulso/contracts';
import { apiGet } from '@/lib/api';

export const adminUnitsKey = ['admin', 'units'] as const;

/** Todas as unidades, inclusive as inativas (só administração). */
export function useAllUnits() {
  return useQuery({
    queryKey: adminUnitsKey,
    queryFn: ({ signal }) => apiGet<UnitView[]>('/units?includeInactive=true', { signal }),
    staleTime: 60_000,
  });
}

/** Opções de unidade para filtros (ativas primeiro). */
export function unitOptions(units: UnitView[] | undefined) {
  return [...(units ?? [])]
    .sort(
      (a, b) =>
        Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') ||
        a.name.localeCompare(b.name),
    )
    .map((unit) => ({
      value: unit.id,
      label: unit.status === 'ACTIVE' ? unit.name : `${unit.name} (inativa)`,
    }));
}

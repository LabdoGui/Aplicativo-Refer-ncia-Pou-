import { useSearchParams } from 'react-router-dom';
import { todayIso } from '@/lib/format';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Unidade e dia da agenda guardados na URL (?unidade=&data=): voltar do
 * atendimento ou recarregar a página mantém a seleção.
 */
export function useAgendaParams(allowedUnitIds: readonly string[]) {
  const [params, setParams] = useSearchParams();
  const requestedUnit = params.get('unidade');
  const requestedDate = params.get('data');
  const unitId =
    requestedUnit && allowedUnitIds.includes(requestedUnit) ? requestedUnit : allowedUnitIds[0];
  const date = requestedDate && ISO_DATE.test(requestedDate) ? requestedDate : todayIso();

  function update(next: { unitId?: string; date?: string }) {
    const value = new URLSearchParams(params);
    if (next.unitId) value.set('unidade', next.unitId);
    if (next.date) value.set('data', next.date);
    setParams(value, { replace: true });
  }

  return { unitId, date, update };
}

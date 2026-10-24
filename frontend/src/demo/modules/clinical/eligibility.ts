import { addDays, toLocalDate } from '../../core/support';

/**
 * Data informativa da próxima doação (RN04): dia local da doação + intervalo
 * configurado. Só orienta; quem decide é a equipe no atendimento.
 * (Cópia de donations/eligibility.ts, que importa @pulso/common.)
 */
export function nextEligibleDate(occurredAt: string, intervalDays: number): string {
  return addDays(toLocalDate(occurredAt), intervalDays);
}

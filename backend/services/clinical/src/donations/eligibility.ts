import { addDays, toLocalDate } from '@pulso/common';

/**
 * Data informativa da próxima doação (RN04): dia local da doação + intervalo
 * configurado. Só orienta; quem decide é a equipe no atendimento.
 */
export function nextEligibleDate(occurredAt: Date, intervalDays: number): string {
  return addDays(toLocalDate(occurredAt), intervalDays);
}

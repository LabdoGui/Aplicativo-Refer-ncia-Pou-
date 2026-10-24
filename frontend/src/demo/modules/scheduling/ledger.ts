/**
 * Livro das vagas (appointments/slot-ledger.ts): reserva atômica respeitando a
 * capacidade (RN01) e devolução do lugar no cancelamento/reagendamento.
 */
import type { GeneratedSlot } from '@backend/services/scheduling/src/domain/schedule';
import { fail } from '../../core/http';
import { uuid } from '../../core/support';
import { state, type SchedulingSlot } from './model';

function findSlot(unitId: string, startsAt: string): SchedulingSlot | undefined {
  return state().slots.find((slot) => slot.unitId === unitId && slot.startsAt === startsAt);
}

/**
 * Reserva um lugar na vaga. A vaga é materializada na primeira reserva e, nas
 * seguintes, a capacidade acompanha a regra vigente da unidade (nunca abaixo
 * das reservas já feitas, que continuam válidas). Devolve o id da vaga.
 */
export function reserveSlot(unitId: string, slot: GeneratedSlot): string {
  const startsAt = slot.startsAt.toISOString();
  let existing = findSlot(unitId, startsAt);
  if (!existing) {
    existing = {
      id: uuid(),
      unitId,
      startsAt,
      endsAt: slot.endsAt.toISOString(),
      capacity: slot.capacity,
      bookedCount: 0,
    };
    state().slots.push(existing);
  } else {
    existing.capacity = Math.max(existing.bookedCount, slot.capacity);
  }
  if (existing.bookedCount >= existing.capacity) {
    fail(409, 'SLOT_FULL', 'Este horário acabou de lotar. Escolha outro.');
  }
  existing.bookedCount += 1;
  return existing.id;
}

/** Devolve o lugar de uma vaga (cancelamento ou reagendamento). */
export function releaseSlot(slotId: string): void {
  const slot = state().slots.find((candidate) => candidate.id === slotId);
  if (slot && slot.bookedCount > 0) slot.bookedCount -= 1;
}

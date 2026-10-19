import type { AvailabilityDay, AvailabilitySlot, CampaignView } from '@pulso/contracts';
import { addDaysIso, todayIso } from '@/lib/format';

/** Janela exibida na tela: hoje e as próximas 4 semanas (o servidor aceita até 31 dias). */
export const AVAILABILITY_DAYS = 28;

export function availabilityRange(today = todayIso()): { from: string; to: string } {
  return { from: today, to: addDaysIso(today, AVAILABILITY_DAYS - 1) };
}

/** Dias com alguma vaga na grade (lotados incluídos, para mostrar "Lotado"). */
export const daysWithSlots = (days: AvailabilityDay[]) => days.filter((d) => d.slots.length > 0);

export const isDayFull = (day: AvailabilityDay) => day.slots.every((slot) => slot.remaining <= 0);

export const vacancyLabel = (slot: AvailabilitySlot) =>
  slot.remaining <= 0 ? 'Lotado' : slot.remaining === 1 ? '1 vaga' : `${slot.remaining} vagas`;

/** Campanha vale para a unidade e a data escolhidas (mesma regra do servidor). */
export function campaignAppliesTo(campaign: CampaignView, unitId: string, date: string): boolean {
  return (
    campaign.active &&
    (campaign.unit === null || campaign.unit.id === unitId) &&
    campaign.startsAt <= date &&
    date <= campaign.endsAt
  );
}

/**
 * Erros que pedem outro horário: a lista de vagas é recarregada e o doador volta
 * para a etapa de horário.
 */
export const PICK_ANOTHER_TIME = new Set(['SLOT_FULL', 'TOO_SOON', 'INVALID_SLOT', 'SLOT_BLOCKED']);

export type BookingStep = 'unit' | 'date' | 'time' | 'confirm';

export const BOOKING_STEPS: ReadonlyArray<{ key: BookingStep; label: string }> = [
  { key: 'unit', label: 'Unidade' },
  { key: 'date', label: 'Data' },
  { key: 'time', label: 'Horário' },
  { key: 'confirm', label: 'Confirmar' },
];

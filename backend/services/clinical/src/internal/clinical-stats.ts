import { eachLocalDay, toLocalDate } from '@pulso/common';
import {
  BLOOD_TYPES,
  PRE_SCREENING_RESULTS,
  SCREENING_RESULTS,
  type BloodType,
  type ClinicalStats,
  type DonationStatus,
  type PreScreeningResult,
  type ScreeningResult,
} from '@pulso/contracts';

export interface StatsInput {
  from: string;
  to: string;
  donations: Array<{
    status: DonationStatus;
    bloodType: BloodType;
    volumeMl: number;
    unitId: string;
    unitName: string;
    occurredAt: Date;
  }>;
  attendances: Array<{ result: ScreeningResult }>;
  preScreenings: Array<{ result: PreScreeningResult }>;
}

/** Agrega as estatísticas do período (dias e meses no fuso America/Sao_Paulo). */
export function buildClinicalStats(input: StatsInput): ClinicalStats {
  const completed = input.donations.filter((donation) => donation.status === 'COMPLETED');
  const perDay = new Map<string, number>();
  const perMonth = new Map<string, number>();
  const perType = new Map<BloodType, number>();
  const perUnit = new Map<string, { unitName: string; count: number }>();
  for (const donation of completed) {
    const day = toLocalDate(donation.occurredAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    perMonth.set(day.slice(0, 7), (perMonth.get(day.slice(0, 7)) ?? 0) + 1);
    perType.set(donation.bloodType, (perType.get(donation.bloodType) ?? 0) + 1);
    const unit = perUnit.get(donation.unitId) ?? { unitName: donation.unitName, count: 0 };
    unit.count += 1;
    perUnit.set(donation.unitId, unit);
  }
  const days = eachLocalDay(input.from, input.to);
  const months = [...new Set(days.map((day) => day.slice(0, 7)))];
  const count = <T extends string>(items: Array<{ result: T }>, result: T) =>
    items.filter((item) => item.result === result).length;

  return {
    donationsCompleted: completed.length,
    donationsNotCompleted: input.donations.length - completed.length,
    attendances: input.attendances.length,
    volumeMl: completed.reduce((sum, donation) => sum + donation.volumeMl, 0),
    byDay: days.map((date) => ({ date, count: perDay.get(date) ?? 0 })),
    byMonth: months.map((month) => ({ month, count: perMonth.get(month) ?? 0 })),
    byBloodType: BLOOD_TYPES.map((bloodType) => ({
      bloodType,
      count: perType.get(bloodType) ?? 0,
    })),
    byUnit: [...perUnit.entries()]
      .map(([unitId, unit]) => ({ unitId, unitName: unit.unitName, count: unit.count }))
      .sort((a, b) => b.count - a.count),
    screeningOutcomes: SCREENING_RESULTS.map((result) => ({
      result,
      count: count(input.attendances, result),
    })),
    preScreenings: PRE_SCREENING_RESULTS.map((result) => ({
      result,
      count: count(input.preScreenings, result),
    })),
  };
}

/**
 * Estatísticas do período (rota interna GET /internal/stats do clinical-service,
 * espelho de internal/internal.controller.ts + internal/clinical-stats.ts).
 */
import {
  BLOOD_TYPES,
  PRE_SCREENING_RESULTS,
  SCREENING_RESULTS,
  type BloodType,
  type ClinicalStats,
  type StatsFilters,
} from '@pulso/contracts';
import { eachLocalDay, inRange, statsRange, toLocalDate } from '../../core/support';
import { clinical } from './state';

export function clinicalStats(query: StatsFilters): ClinicalStats {
  const range = statsRange(query);
  const state = clinical();
  const donations = state.donations.filter(
    (donation) =>
      inRange(donation.occurredAt, range) &&
      (!query.unitId || donation.unitId === query.unitId) &&
      (!query.bloodType || donation.bloodType === query.bloodType),
  );
  const attendances = state.attendances.filter(
    (attendance) =>
      inRange(attendance.createdAt, range) && (!query.unitId || attendance.unitId === query.unitId),
  );
  // A pré-triagem não tem unidade: o filtro de unidade não se aplica a ela.
  const preScreenings = state.preScreenings.filter((record) => inRange(record.createdAt, range));

  // Agrega o período (dias e meses no fuso America/Sao_Paulo).
  const completed = donations.filter((donation) => donation.status === 'COMPLETED');
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
  const days = eachLocalDay(query.from, query.to);
  const months = [...new Set(days.map((day) => day.slice(0, 7)))];
  const count = <T extends string>(items: Array<{ result: T }>, result: T) =>
    items.filter((item) => item.result === result).length;

  return {
    donationsCompleted: completed.length,
    donationsNotCompleted: donations.length - completed.length,
    attendances: attendances.length,
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
      count: count(attendances, result),
    })),
    preScreenings: PRE_SCREENING_RESULTS.map((result) => ({
      result,
      count: count(preScreenings, result),
    })),
  };
}

/** Rotas /internal do identity (internal.controller.ts), chamadas pelos outros serviços. */
import type { IdentityStats } from '@pulso/contracts';
import { internal } from '../../core/internal';
import { ageOn, eachLocalDay, inRange, statsRange, toLocalDate } from '../../core/support';
import { findUser, state } from './model';

export function registerIdentityInternal(): void {
  /** Resumo de doadores para agenda e atendimento (sem dados de contato). */
  internal.identity.donorSummaries = (ids) =>
    state()
      .users.filter((user) => ids.includes(user.id))
      .map((user) => ({
        id: user.id,
        name: user.status === 'ANONYMIZED' ? 'Conta removida' : user.name,
        donorCode: user.donor?.donorCode ?? '—',
        age: user.donor ? ageOn(user.donor.birthDate) : null,
        declaredBloodType: user.donor?.declaredBloodType ?? null,
      }));

  /** Quem, entre os IDs, aceitou "Lembretes e comunicações" (contas ativas). */
  internal.identity.communicationsConsent = (ids) => ({
    granted: state()
      .consents.filter(
        (consent) =>
          ids.includes(consent.userId) &&
          consent.purpose === 'COMMUNICATIONS' &&
          consent.granted &&
          findUser(consent.userId)?.status === 'ACTIVE',
      )
      .map((consent) => consent.userId),
  });

  /** IDs das contas ativas de um papel (ex.: alertas de estoque para administradores). */
  internal.identity.usersByRole = (role) =>
    state()
      .users.filter((user) => user.role === role && user.status === 'ACTIVE')
      .map((user) => ({ id: user.id }));

  internal.identity.stats = (filters): IdentityStats => {
    const range = statsRange(filters);
    const users = state().users;
    const donorsTotal = users.filter(
      (user) => user.role === 'DONOR' && user.status !== 'ANONYMIZED',
    ).length;
    const staffTotal = users.filter(
      (user) => user.role !== 'DONOR' && user.status === 'ACTIVE',
    ).length;
    // Novos doadores no período contam também as contas excluídas depois (como o back-end).
    const newDonors = users.filter(
      (user) => user.role === 'DONOR' && inRange(user.createdAt, range),
    );
    const perDay = new Map<string, number>();
    for (const { createdAt } of newDonors) {
      const day = toLocalDate(createdAt);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    return {
      donorsTotal,
      donorsNewInPeriod: newDonors.length,
      newDonorsByDay: eachLocalDay(filters.from, filters.to).map((date) => ({
        date,
        count: perDay.get(date) ?? 0,
      })),
      staffTotal,
    };
  };
}

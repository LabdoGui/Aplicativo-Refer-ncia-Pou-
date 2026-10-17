import type { ComplementaryHoursView, HoursStatus, InstitutionView } from '@pulso/contracts';
import type { ComplementaryHours, PartnerInstitution } from '../../generated/prisma';

export function toInstitutionView(row: PartnerInstitution): InstitutionView {
  return {
    id: row.id,
    name: row.name,
    hoursPerDonation: row.hoursPerDonation,
    active: row.active,
  };
}

export function toHoursView(
  row: ComplementaryHours & { institution: Pick<PartnerInstitution, 'id' | 'name'> },
): ComplementaryHoursView {
  return {
    id: row.id,
    institution: { id: row.institution.id, name: row.institution.name },
    hours: row.hours,
    status: row.status as HoursStatus,
    donationId: row.donationId,
    donatedAt: row.donatedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Contas fictícias de demonstração (porte de seed/seed.service.ts). */
import { TERMS_VERSION } from '@pulso/contracts';
import { SEED_PASSWORD } from '@backend/libs/common/src/seed/dataset';
import type { SeedContext } from '../../core/state';
import type { IdentityConsent, IdentityState, IdentityUser } from './model';

export function seedIdentity({ dataset }: SeedContext): IdentityState {
  const users: IdentityUser[] = [];
  const consents: IdentityConsent[] = [];
  for (const [index, user] of dataset.users.entries()) {
    users.push({
      id: user.id,
      email: user.email,
      password: SEED_PASSWORD,
      name: user.name,
      role: user.role,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
      donor: user.donor
        ? {
            donorCode: user.donor.donorCode,
            birthDate: user.donor.birthDate,
            phone: user.donor.phone,
            declaredBloodType: index % 3 === 0 ? null : user.donor.bloodType,
            city: user.donor.city,
          }
        : null,
      professional:
        user.role !== 'DONOR'
          ? { unitIds: user.unitIds, registryNumber: user.registryNumber }
          : null,
    });
    consents.push(
      {
        userId: user.id,
        purpose: 'TERMS_PRIVACY',
        granted: true,
        version: TERMS_VERSION,
        grantedAt: user.createdAt,
        revokedAt: null,
        updatedAt: user.createdAt,
      },
      {
        userId: user.id,
        purpose: 'COMMUNICATIONS',
        granted: index % 5 !== 0,
        version: TERMS_VERSION,
        grantedAt: index % 5 !== 0 ? user.createdAt : null,
        revokedAt: null,
        updatedAt: user.createdAt,
      },
    );
  }
  return { users, consents, sessions: [], accessTokens: {}, deviceFamilyId: null };
}

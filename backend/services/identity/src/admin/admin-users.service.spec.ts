import type { AuthUser } from '@pulso/contracts';
import { AdminUsersService } from './admin-users.service';

const admin: AuthUser = { id: 'a1', role: 'ADMIN', name: 'Ana', unitIds: [] };

const nurse = {
  id: 'n1',
  name: 'Carlos Lima',
  email: 'carlos@exemplo.test',
  role: 'NURSE',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  lastLoginAt: null,
  donorProfile: null,
  professionalProfile: { unitIds: ['u-centro', 'u-campus'], registryNumber: 'COREN-1' },
};

function setup() {
  const prisma = {
    user: { findUnique: jest.fn(async () => nurse) },
    $transaction: jest.fn(),
  };
  const tx = { user: { update: jest.fn(async () => nurse) } };
  prisma.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  const auth = { revokeAllSessions: jest.fn(async () => undefined) };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new AdminUsersService(
    prisma as never,
    {} as never,
    auth as never,
    audit as never,
  );
  return { service, auth, audit };
}

describe('AdminUsersService.update', () => {
  it('formulário reenviado com o mesmo papel e unidades (outra ordem) não derruba as sessões', async () => {
    const { service, auth, audit } = setup();
    await service.update(admin, nurse.id, {
      name: 'Carlos Lima',
      role: 'NURSE',
      unitIds: ['u-campus', 'u-centro'],
      registryNumber: 'COREN-2',
      status: 'ACTIVE',
    });
    expect(auth.revokeAllSessions).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { fields: ['registryNumber'] } }),
      expect.anything(),
    );
  });

  it('mudança real de unidades encerra as sessões', async () => {
    const { service, auth } = setup();
    await service.update(admin, nurse.id, { role: 'NURSE', unitIds: ['u-centro'] });
    expect(auth.revokeAllSessions).toHaveBeenCalledWith(nurse.id);
  });

  it('desativar encerra as sessões', async () => {
    const { service, auth } = setup();
    await service.update(admin, nurse.id, { status: 'DISABLED' });
    expect(auth.revokeAllSessions).toHaveBeenCalledWith(nurse.id);
  });
});

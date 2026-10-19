import { AppException } from '@pulso/common';
import type { AuthUser } from '@pulso/contracts';
import { AccountService } from './account.service';

type Mock = jest.Mock;

const actor: AuthUser = {
  id: '6f1b0a52-3a52-4a8e-9d5e-0c4a9b1f2e11',
  role: 'DONOR',
  name: 'Doadora',
  unitIds: [],
  sessionId: 'familia-atual',
};

const user = {
  id: actor.id,
  role: 'DONOR',
  status: 'ACTIVE',
  passwordHash: 'hash',
  lockedUntil: null,
  donorProfile: null,
  professionalProfile: null,
};

function setup() {
  const prisma = {
    user: { findUnique: jest.fn(async () => user) as Mock, update: jest.fn(async () => user) },
    donorProfile: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    professionalProfile: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    consent: { deleteMany: jest.fn(async () => ({ count: 2 })) },
    refreshToken: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    $transaction: jest.fn() as Mock,
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  const passwords = {
    verify: jest.fn(async () => true) as Mock,
    hash: jest.fn(async () => 'novo-hash'),
  };
  const auth = {
    reservePasswordAttempt: jest.fn(async () => undefined),
    confirmPasswordAttempt: jest.fn(async () => undefined),
    registerFailedPassword: jest.fn(async () => undefined),
    revokeAllSessions: jest.fn(async () => undefined),
    familyOf: jest.fn(async () => undefined),
  };
  const audit = { record: jest.fn(async () => undefined) };
  const outbox = { enqueue: jest.fn(async () => ({})) };
  const service = new AccountService(
    prisma as never,
    {} as never,
    passwords as never,
    auth as never,
    audit as never,
    outbox as never,
  );
  return { service, prisma, passwords, auth, outbox };
}

const dto = { currentPassword: 'Atual#2026', newPassword: 'Nova#Senha2026' };

describe('AccountService.changePassword', () => {
  it('encerra as outras sessões e mantém a atual (claim sid do access token)', async () => {
    const { service, auth } = setup();
    await service.changePassword(actor, dto, undefined);
    expect(auth.revokeAllSessions).toHaveBeenCalledWith(actor.id, 'familia-atual');
    expect(auth.familyOf).not.toHaveBeenCalled();
  });

  it('senha atual errada conta como tentativa e não altera nada', async () => {
    const { service, prisma, passwords, auth } = setup();
    passwords.verify.mockResolvedValueOnce(false);
    const promise = service.changePassword(actor, dto, undefined);
    await expect(promise).rejects.toBeInstanceOf(AppException);
    await promise.catch((error: AppException) => expect(error.code).toBe('WRONG_PASSWORD'));
    expect(auth.registerFailedPassword).toHaveBeenCalledWith(
      actor.id,
      'user.password_check_failed',
      undefined,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('respeita o bloqueio por tentativas antes de conferir a senha', async () => {
    const { service, passwords, auth } = setup();
    auth.reservePasswordAttempt.mockRejectedValueOnce(
      new AppException(429, 'ACCOUNT_LOCKED', 'Bloqueada'),
    );
    await expect(service.changePassword(actor, dto, undefined)).rejects.toBeInstanceOf(
      AppException,
    );
    expect(passwords.verify).not.toHaveBeenCalled();
  });
});

describe('AccountService.deleteAccount', () => {
  it('anonimiza a conta e publica identity.user.deleted na mesma transação', async () => {
    const { service, prisma, outbox } = setup();
    await service.deleteAccount(actor, 'certa');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ANONYMIZED' }) }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      'identity.user.deleted',
      expect.objectContaining({ userId: actor.id }),
      undefined,
    );
  });

  it('senha errada conta como tentativa', async () => {
    const { service, passwords, auth } = setup();
    passwords.verify.mockResolvedValueOnce(false);
    await expect(service.deleteAccount(actor, 'errada')).rejects.toBeInstanceOf(AppException);
    expect(auth.registerFailedPassword).toHaveBeenCalledWith(
      actor.id,
      'user.password_check_failed',
      undefined,
    );
  });
});

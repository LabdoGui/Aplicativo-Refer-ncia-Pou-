import { AppException } from '@pulso/common';
import { AuthService, MAX_FAILED_LOGINS, REFRESH_REUSE_GRACE_MS } from './auth.service';
import { hashRefreshToken } from './token.service';

type Mock = jest.Mock;

function makeService() {
  const prisma = {
    user: {
      findUnique: jest.fn() as Mock,
      update: jest.fn(async () => ({ failedLoginAttempts: 1 })) as Mock,
      updateMany: jest.fn(async () => ({ count: 1 })) as Mock,
      create: jest.fn() as Mock,
    },
    refreshToken: {
      findUnique: jest.fn() as Mock,
      updateMany: jest.fn(async () => ({ count: 1 })) as Mock,
      create: jest.fn(async () => ({})) as Mock,
    },
    donorProfile: { findUnique: jest.fn(async () => null) as Mock },
    // Reserva da tentativa: devolve a linha quando a conta não está bloqueada.
    $queryRaw: jest.fn(async () => [{ failedLoginAttempts: 1 }]) as Mock,
    $transaction: jest.fn() as Mock,
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  const passwords = {
    hash: jest.fn(async () => 'hash'),
    verify: jest.fn(async () => true) as Mock,
    verifyDummy: jest.fn(async () => undefined) as Mock,
  };
  const tokens = {
    signAccessToken: jest.fn(async () => 'access-token'),
    newRefreshToken: jest.fn(() => ({
      token: 'novo-refresh',
      tokenHash: hashRefreshToken('novo-refresh'),
    })),
    accessTokenTtlSeconds: 900,
    refreshTokenTtlMs: 7 * 86_400_000,
  };
  const outbox = { enqueue: jest.fn(async () => ({})) };
  const audit = { record: jest.fn(async () => undefined) as Mock };
  const encryption = { encrypt: jest.fn((value: string) => `cifrado:${value}`) };
  const service = new AuthService(
    prisma as never,
    passwords as never,
    tokens as never,
    encryption as never,
    outbox as never,
    audit as never,
    { COOKIE_SECURE: false } as never,
  );
  return { service, prisma, passwords, outbox, audit, tokens };
}

const user = {
  id: '6f1b0a52-3a52-4a8e-9d5e-0c4a9b1f2e11',
  email: 'doador@demo.com',
  name: 'Doadora',
  role: 'DONOR',
  status: 'ACTIVE',
  passwordHash: 'hash',
  failedLoginAttempts: 0,
  lockedUntil: null,
  professionalProfile: null,
};

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => expect(error.code).toBe(code));
}

describe('AuthService.register', () => {
  const base = {
    name: 'Maria Teste',
    email: 'maria@exemplo.test',
    password: 'Senha1234',
    acceptTerms: true,
  };

  it('recusa menores de 18 anos (RN18) sem gravar nada', async () => {
    const { service, prisma } = makeService();
    await expectCode(service.register({ ...base, birthDate: '2015-01-01' }, {}), 'AGE_RESTRICTION');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recusa data de nascimento futura', async () => {
    const { service } = makeService();
    await expectCode(
      service.register({ ...base, birthDate: '2999-01-01' }, {}),
      'INVALID_BIRTH_DATE',
    );
  });

  it('cria a conta, grava o evento no outbox e devolve a sessão', async () => {
    const { service, prisma, outbox } = makeService();
    prisma.user.create.mockResolvedValue({ ...user, email: base.email, name: base.name });
    const issued = await service.register(
      { ...base, birthDate: '1990-06-15', phone: '11912345678' },
      {},
    );
    expect(issued.session.accessToken).toBe('access-token');
    expect(issued.refreshToken).toBe('novo-refresh');
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe('DONOR');
    expect(data.donorProfile.create.phoneEncrypted).toBe('cifrado:11912345678');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      'identity.user.registered',
      expect.objectContaining({ role: 'DONOR' }),
      undefined,
    );
  });
});

describe('AuthService.login', () => {
  it('responde igual para e-mail inexistente e senha errada', async () => {
    const { service, prisma, passwords } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expectCode(service.login({ email: 'x@y.z', password: 'a' }, {}), 'INVALID_CREDENTIALS');
    expect(passwords.verifyDummy).toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValueOnce(user);
    passwords.verify.mockResolvedValueOnce(false);
    await expectCode(
      service.login({ email: user.email, password: 'errada' }, {}),
      'INVALID_CREDENTIALS',
    );
  });

  it('reserva a tentativa antes de conferir a senha e audita a falha', async () => {
    const { service, prisma, passwords, audit } = makeService();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    passwords.verify.mockResolvedValue(false);
    await expectCode(
      service.login({ email: user.email, password: 'errada' }, {}),
      'INVALID_CREDENTIALS',
    );
    const reserve = prisma.$queryRaw.mock.calls[0][0].join('?');
    expect(reserve).toContain('"failedLoginAttempts" = "failedLoginAttempts" + 1');
    expect(reserve).toContain('"lockedUntil" IS NULL');
    expect(reserve).toContain('"failedLoginAttempts" <');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_failed', entityId: user.id }),
    );
    expect(audit.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.account_locked' }),
    );
  });

  it(`bloqueia a conta ao atingir ${MAX_FAILED_LOGINS} senhas erradas`, async () => {
    const { service, prisma, passwords, audit } = makeService();
    prisma.user.findUnique.mockResolvedValue(user);
    passwords.verify.mockResolvedValue(false);
    await expectCode(
      service.login({ email: user.email, password: 'errada' }, {}),
      'INVALID_CREDENTIALS',
    );
    const lock = prisma.user.updateMany.mock.calls[0][0];
    expect(lock.where).toEqual(
      expect.objectContaining({ id: user.id, failedLoginAttempts: { gte: MAX_FAILED_LOGINS } }),
    );
    expect(lock.data.lockedUntil).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.account_locked' }),
    );
  });

  it('com a conta bloqueada (ou o limite tomado por tentativas simultâneas) nem confere a senha', async () => {
    const { service, prisma, passwords } = makeService();
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ lockedUntil: new Date(Date.now() + 60_000) });
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expectCode(
      service.login({ email: user.email, password: 'qualquer' }, {}),
      'ACCOUNT_LOCKED',
    );
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('senha certa não abre sessão se outra tentativa bloqueou a conta no meio-tempo', async () => {
    const { service, prisma, tokens } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce({
      lockedUntil: new Date(Date.now() + 60_000),
    });
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expectCode(service.login({ email: user.email, password: 'certa' }, {}), 'ACCOUNT_LOCKED');
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
  });

  it('recusa conta desativada mesmo com a senha certa', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...user, status: 'DISABLED' });
    await expectCode(
      service.login({ email: user.email, password: 'certa' }, {}),
      'ACCOUNT_DISABLED',
    );
  });
});

describe('AuthService.refresh', () => {
  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 'rt-1',
    userId: user.id,
    familyId: 'familia-1',
    tokenHash: hashRefreshToken('antigo'),
    expiresAt: new Date(Date.now() + 60_000),
    rotatedAt: null,
    revokedAt: null,
    user,
    ...overrides,
  });

  it('rotaciona: marca o token atual e emite outro da mesma família', async () => {
    const { service, prisma } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValue(stored());
    const issued = await service.refresh('antigo', {});
    expect(issued.refreshToken).toBe('novo-refresh');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1', rotatedAt: null, revokedAt: null } }),
    );
    expect(prisma.refreshToken.create.mock.calls[0][0].data.familyId).toBe('familia-1');
  });

  it('reuso de token já trocado revoga a família inteira', async () => {
    const { service, prisma, audit } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValue(
      stored({ rotatedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1_000) }),
    );
    await expectCode(service.refresh('antigo', {}), 'SESSION_EXPIRED');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'familia-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh_reuse_detected' }),
    );
  });

  it('reuso logo após a troca é tratado como corrida entre abas (sem revogar)', async () => {
    const { service, prisma } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValue(stored({ rotatedAt: new Date() }));
    await expectCode(service.refresh('antigo', {}), 'REFRESH_RACE');
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('recusa token vencido, revogado, ausente ou de conta inativa', async () => {
    const { service, prisma } = makeService();
    await expectCode(service.refresh(undefined, {}), 'SESSION_EXPIRED');
    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      stored({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expectCode(service.refresh('antigo', {}), 'SESSION_EXPIRED');
    prisma.refreshToken.findUnique.mockResolvedValueOnce(stored({ revokedAt: new Date() }));
    await expectCode(service.refresh('antigo', {}), 'SESSION_EXPIRED');
    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      stored({ user: { ...user, status: 'DISABLED' } }),
    );
    await expectCode(service.refresh('antigo', {}), 'SESSION_EXPIRED');
  });
});

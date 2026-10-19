import { Logger, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HEADERS, type AuthUser } from '@pulso/contracts';
import { errors } from 'jose';
import type { BaseEnv } from '../config/env';
import { AppException } from '../errors/app.exception';
import { AuthGuard } from './auth.guard';
import { InternalOnly, Public, RequirePermissions, Roles } from './decorators';
import type { TokenVerifier } from './token-verifier';

const INTERNAL_TOKEN = 'token-interno-de-teste-123';

const USERS: Record<string, AuthUser> = {
  'token-doador': { id: 'u-doador', role: 'DONOR', name: 'Doador Fictício', unitIds: [] },
  'token-enfermeiro': {
    id: 'u-enf',
    role: 'NURSE',
    name: 'Enfermeira Fictícia',
    unitIds: ['un-1'],
  },
  'token-admin': { id: 'u-admin', role: 'ADMIN', name: 'Admin Fictício', unitIds: [] },
};

/** Tokens que simulam falhas de infraestrutura ao validar (não são problema da credencial). */
const UNAVAILABLE_ERRORS: Record<string, () => Error> = {
  'token-jwks-lento': () => new errors.JWKSTimeout(),
  'token-jwks-404': () =>
    new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response'),
  'token-jwks-invalido': () => new errors.JWKSInvalid(),
  'token-rede': () =>
    Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3001'), {
      code: 'ECONNREFUSED',
      syscall: 'connect',
    }),
};

/** Verificador falso: aceita apenas os tokens de USERS; os demais falham como o jose falharia. */
const fakeVerifier: TokenVerifier = {
  verify: async (token) => {
    const user = USERS[token];
    if (user) return user;
    const unavailable = UNAVAILABLE_ERRORS[token];
    if (unavailable) throw unavailable();
    if (token === 'token-vencido')
      throw new errors.JWTExpired('"exp" claim timestamp check failed', {});
    throw new errors.JWSSignatureVerificationFailed();
  },
};

class FakeController {
  protectedRoute() {}

  @Public()
  publicRoute() {}

  @Roles('ADMIN')
  adminRoute() {}

  @RequirePermissions('screening:perform')
  screeningRoute() {}

  @InternalOnly()
  internalRoute() {}
}

@Roles('ADMIN')
class AdminController {
  anyRoute() {}

  @Roles('DONOR')
  donorOverride() {}
}

/** Recurso com leitura pública e escrita restrita (ex.: campanhas, unidades). */
@Public()
class PublicResourceController {
  list() {}

  @Roles('ADMIN')
  create() {}

  @RequirePermissions('campaign:manage')
  update() {}
}

type AnyController =
  typeof FakeController | typeof AdminController | typeof PublicResourceController;
type AnyHandler = keyof FakeController | keyof AdminController | keyof PublicResourceController;

interface FakeRequest {
  headers: Record<string, string | undefined>;
  method?: string;
  user?: AuthUser;
}

function createContext(
  handler: AnyHandler,
  headers: Record<string, string> = {},
  controller: AnyController = FakeController,
): { context: ExecutionContext; request: FakeRequest } {
  const request: FakeRequest = { headers };
  const context = {
    getType: () => 'http',
    getHandler: () => (controller.prototype as unknown as Record<string, () => void>)[handler],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function expectAppException(
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AppException);
  expect((error as AppException).getStatus()).toBe(status);
  expect((error as AppException).code).toBe(code);
}

describe('AuthGuard', () => {
  const guard = new AuthGuard(new Reflector(), fakeVerifier, {
    INTERNAL_API_TOKEN: INTERNAL_TOKEN,
  } as BaseEnv);
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('rotas públicas', () => {
    it('permite acesso sem token', async () => {
      const { context, request } = createContext('publicRoute');

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toBeUndefined();
    });

    it('permite acesso com token inválido, sem anexar usuário', async () => {
      const { context, request } = createContext('publicRoute', bearer('token-falso'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toBeUndefined();
    });

    it('anexa o usuário quando o token é válido', async () => {
      const { context, request } = createContext('publicRoute', bearer('token-doador'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toEqual(USERS['token-doador']);
    });
  });

  describe('rotas protegidas', () => {
    it('exige token (401 AUTH_REQUIRED)', async () => {
      const { context } = createContext('protectedRoute');

      await expectAppException(guard.canActivate(context), 401, 'AUTH_REQUIRED');
    });

    it('ignora esquema diferente de Bearer (401 AUTH_REQUIRED)', async () => {
      const { context } = createContext('protectedRoute', { authorization: 'Basic abc' });

      await expectAppException(guard.canActivate(context), 401, 'AUTH_REQUIRED');
    });

    it('rejeita token inválido (401 TOKEN_INVALID)', async () => {
      const { context, request } = createContext('protectedRoute', bearer('token-falso'));

      await expectAppException(guard.canActivate(context), 401, 'TOKEN_INVALID');
      expect(request.user).toBeUndefined();
    });

    it('rejeita token vencido (401 TOKEN_INVALID), sem registrar erro', async () => {
      const { context } = createContext('protectedRoute', bearer('token-vencido'));

      await expectAppException(guard.canActivate(context), 401, 'TOKEN_INVALID');
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('aceita token válido, com esquema em qualquer caixa, e anexa o usuário', async () => {
      const { context, request } = createContext('protectedRoute', {
        authorization: 'bearer token-enfermeiro',
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user?.role).toBe('NURSE');
    });
  });

  describe('@Roles', () => {
    it('permite o papel exigido', async () => {
      const { context } = createContext('adminRoute', bearer('token-admin'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('nega outro papel (403 FORBIDDEN_ROLE)', async () => {
      const { context } = createContext('adminRoute', bearer('token-doador'));

      await expectAppException(guard.canActivate(context), 403, 'FORBIDDEN_ROLE');
    });

    it('aplica o papel definido na classe a todos os métodos', async () => {
      const { context } = createContext('anyRoute', bearer('token-enfermeiro'), AdminController);

      await expectAppException(guard.canActivate(context), 403, 'FORBIDDEN_ROLE');
    });

    it('dá precedência ao papel definido no método', async () => {
      const donor = createContext('donorOverride', bearer('token-doador'), AdminController);
      const admin = createContext('donorOverride', bearer('token-admin'), AdminController);

      await expect(guard.canActivate(donor.context)).resolves.toBe(true);
      await expectAppException(guard.canActivate(admin.context), 403, 'FORBIDDEN_ROLE');
    });
  });

  describe('@RequirePermissions', () => {
    it('permite quem tem a permissão (NURSE tem screening:perform)', async () => {
      const { context } = createContext('screeningRoute', bearer('token-enfermeiro'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('nega quem não tem a permissão (ADMIN não tem screening:perform)', async () => {
      const { context } = createContext('screeningRoute', bearer('token-admin'));

      await expectAppException(guard.canActivate(context), 403, 'FORBIDDEN_PERMISSION');
    });

    it('exige autenticação antes de avaliar permissões', async () => {
      const { context } = createContext('screeningRoute');

      await expectAppException(guard.canActivate(context), 401, 'AUTH_REQUIRED');
    });
  });

  describe('@Public na classe com @Roles/@RequirePermissions no método', () => {
    it('mantém pública a rota sem exigência de papel', async () => {
      const { context } = createContext('list', {}, PublicResourceController);

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it.each(['create', 'update'] as const)(
      '%s: exige token (401 AUTH_REQUIRED)',
      async (handler) => {
        const { context } = createContext(handler, {}, PublicResourceController);

        await expectAppException(guard.canActivate(context), 401, 'AUTH_REQUIRED');
      },
    );

    it.each(['create', 'update'] as const)(
      '%s: rejeita token inválido (401 TOKEN_INVALID)',
      async (handler) => {
        const { context, request } = createContext(
          handler,
          bearer('token-falso'),
          PublicResourceController,
        );

        await expectAppException(guard.canActivate(context), 401, 'TOKEN_INVALID');
        expect(request.user).toBeUndefined();
      },
    );

    it('nega papel errado (403 FORBIDDEN_ROLE)', async () => {
      const { context } = createContext('create', bearer('token-doador'), PublicResourceController);

      await expectAppException(guard.canActivate(context), 403, 'FORBIDDEN_ROLE');
    });

    it('nega quem não tem a permissão (403 FORBIDDEN_PERMISSION)', async () => {
      const { context } = createContext(
        'update',
        bearer('token-enfermeiro'),
        PublicResourceController,
      );

      await expectAppException(guard.canActivate(context), 403, 'FORBIDDEN_PERMISSION');
    });

    it.each(['create', 'update'] as const)('%s: permite o ADMIN', async (handler) => {
      const { context, request } = createContext(
        handler,
        bearer('token-admin'),
        PublicResourceController,
      );

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user?.role).toBe('ADMIN');
    });
  });

  describe('falha ao validar o token por indisponibilidade', () => {
    it.each(Object.keys(UNAVAILABLE_ERRORS))(
      '%s: responde 503 AUTH_UNAVAILABLE e registra a causa como erro',
      async (token) => {
        const { context, request } = createContext('protectedRoute', bearer(token));

        await expectAppException(guard.canActivate(context), 503, 'AUTH_UNAVAILABLE');
        expect(request.user).toBeUndefined();
        expect(errorLog).toHaveBeenCalledTimes(1);
        expect(errorLog.mock.calls[0][0]).toMatchObject({ err: expect.any(Error) });
      },
    );

    it('também vale para rota com @Roles em classe pública', async () => {
      const { context } = createContext(
        'create',
        bearer('token-jwks-lento'),
        PublicResourceController,
      );

      await expectAppException(guard.canActivate(context), 503, 'AUTH_UNAVAILABLE');
    });

    it('em rota pública segue como anônimo e registra um aviso', async () => {
      const { context, request } = createContext('publicRoute', bearer('token-jwks-lento'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toBeUndefined();
      expect(warnLog).toHaveBeenCalledTimes(1);
      expect(errorLog).not.toHaveBeenCalled();
    });
  });

  describe('@InternalOnly', () => {
    it('permite com o token interno correto', async () => {
      const { context } = createContext('internalRoute', {
        [HEADERS.internalToken]: INTERNAL_TOKEN,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it.each([
      [
        'token errado de mesmo tamanho',
        { [HEADERS.internalToken]: 'x'.repeat(INTERNAL_TOKEN.length) },
      ],
      ['token errado de outro tamanho', { [HEADERS.internalToken]: 'curto' }],
      ['token ausente', {}],
      ['apenas um JWT válido', bearer('token-admin')],
    ])('nega com %s (401 INTERNAL_AUTH_REQUIRED)', async (_label, headers) => {
      const { context } = createContext('internalRoute', headers);

      await expectAppException(guard.canActivate(context), 401, 'INTERNAL_AUTH_REQUIRED');
    });
  });

  it('não interfere em contextos que não são HTTP', async () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  describe('conta excluída com token ainda válido', () => {
    const deleted = { isDeleted: jest.fn(async (id: string) => id === USERS['token-doador'].id) };
    const guarded = new AuthGuard(
      new Reflector(),
      fakeVerifier,
      { INTERNAL_API_TOKEN: INTERNAL_TOKEN } as BaseEnv,
      deleted,
    );

    it('recusa escritas (401 SESSION_EXPIRED)', async () => {
      const { context, request } = createContext('protectedRoute', bearer('token-doador'));
      request.method = 'POST';
      await expectAppException(guarded.canActivate(context), 401, 'SESSION_EXPIRED');
    });

    it('não consulta o registro em leituras', async () => {
      deleted.isDeleted.mockClear();
      const { context, request } = createContext('protectedRoute', bearer('token-doador'));
      request.method = 'GET';
      await expect(guarded.canActivate(context)).resolves.toBe(true);
      expect(deleted.isDeleted).not.toHaveBeenCalled();
    });
  });
});

import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HEADERS, type AuthUser } from '@pulso/contracts';
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

/** Verificador falso: aceita apenas os tokens de USERS. */
const fakeVerifier: TokenVerifier = {
  verify: async (token) => {
    const user = USERS[token];
    if (!user) throw new Error('assinatura inválida');
    return user;
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

interface FakeRequest {
  headers: Record<string, string | undefined>;
  user?: AuthUser;
}

function createContext(
  handler: keyof FakeController | keyof AdminController,
  headers: Record<string, string> = {},
  controller: typeof FakeController | typeof AdminController = FakeController,
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
});

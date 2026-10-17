import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { CurrentUser, Roles, TOKEN_VERIFIER, type TokenVerifier } from '@pulso/common';
import { API_PREFIX, type AuthUser, type ProblemDetails } from '@pulso/contracts';
import { errors } from 'jose';

/**
 * Gateway montado com o AppModule real: o AuthGuard global protege as rotas do
 * próprio gateway, enquanto as rotas encaminhadas seguem para os serviços (aqui,
 * um servidor falso) sem passar por ele.
 */

const USERS: Record<string, AuthUser> = {
  'token-doador': { id: 'u-doador', role: 'DONOR', name: 'Doador Fictício', unitIds: [] },
  'token-admin': { id: 'u-admin', role: 'ADMIN', name: 'Admin Fictício', unitIds: [] },
};

const fakeVerifier: TokenVerifier = {
  verify: async (token) => {
    const user = USERS[token];
    if (user) return user;
    if (token === 'token-jwks-fora') throw new errors.JWKSTimeout();
    throw new errors.JWSSignatureVerificationFailed();
  },
};

/** Rota ADMIN do próprio gateway, como GET /dashboard/statistics da Fase 10. */
@Controller(`${API_PREFIX}/dashboard`)
class FakeDashboardController {
  @Roles('ADMIN')
  @Get('statistics')
  statistics(@CurrentUser() user?: AuthUser): { userId?: string } {
    return { userId: user?.id };
  }
}

interface UpstreamEcho {
  path: string;
  method: string;
  headers: IncomingHttpHeaders;
}

/** Serviço falso: devolve o que recebeu (ou o health/OpenAPI esperado pelo gateway). */
async function startFakeUpstream(): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/health') {
      response.end(JSON.stringify({ status: 'up', version: '0.1.0', checks: { database: 'up' } }));
      return;
    }
    if (request.url === '/docs-json') {
      response.end(
        JSON.stringify({ openapi: '3.0.0', info: { title: 'x', version: '1' }, paths: {} }),
      );
      return;
    }
    const echo: UpstreamEcho = {
      path: request.url ?? '',
      method: request.method ?? '',
      headers: request.headers,
    };
    response.end(JSON.stringify(echo));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

describe('gateway (AppModule): autenticação das rotas próprias × rotas encaminhadas', () => {
  const originalEnv = process.env;
  let upstream: Server;
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const fake = await startFakeUpstream();
    upstream = fake.server;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '3999',
      LOG_LEVEL: 'fatal',
      INTERNAL_API_TOKEN: 'token-interno-de-teste-123',
      JWKS_URL: 'http://127.0.0.1:9/jwks.json',
      IDENTITY_URL: fake.url,
      SCHEDULING_URL: fake.url,
      CLINICAL_URL: fake.url,
      INVENTORY_URL: fake.url,
      ENGAGEMENT_URL: fake.url,
      NOTIFICATION_URL: fake.url,
    };
    // O CoreModule lê o ambiente ao carregar o AppModule: importa só depois de configurar.
    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [FakeDashboardController],
    })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
      bodyParser: false,
    });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    process.env = originalEnv;
  });

  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, { headers });
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  describe('rota do gateway com @Roles("ADMIN")', () => {
    const path = `/${API_PREFIX}/dashboard/statistics`;

    it('anônimo → 401 AUTH_REQUIRED', async () => {
      const response = await get(path);

      expect(response.status).toBe(401);
      expect(((await response.json()) as ProblemDetails).code).toBe('AUTH_REQUIRED');
    });

    it('token inválido → 401 TOKEN_INVALID', async () => {
      const response = await get(path, bearer('token-forjado'));

      expect(response.status).toBe(401);
      expect(((await response.json()) as ProblemDetails).code).toBe('TOKEN_INVALID');
    });

    it('DONOR → 403 FORBIDDEN_ROLE', async () => {
      const response = await get(path, bearer('token-doador'));

      expect(response.status).toBe(403);
      expect(((await response.json()) as ProblemDetails).code).toBe('FORBIDDEN_ROLE');
    });

    it('ADMIN → 200, com o usuário disponível para a rota', async () => {
      const response = await get(path, bearer('token-admin'));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ userId: 'u-admin' });
    });

    it('chaves indisponíveis → 503 AUTH_UNAVAILABLE', async () => {
      const response = await get(path, bearer('token-jwks-fora'));

      expect(response.status).toBe(503);
      expect(((await response.json()) as ProblemDetails).code).toBe('AUTH_UNAVAILABLE');
    });
  });

  describe('rotas públicas do gateway', () => {
    it.each(['/health', `/${API_PREFIX}/health`, `/${API_PREFIX}/health/services`, '/api/docs'])(
      '%s responde 200 sem token',
      async (path) => {
        expect((await get(path)).status).toBe(200);
      },
    );

    it('GET /api/v1/health informa que o gateway está no ar', async () => {
      const body = await (await get(`/${API_PREFIX}/health`)).json();

      expect(body).toMatchObject({ status: 'up', service: 'gateway', checks: {} });
    });
  });

  describe('rotas encaminhadas aos serviços (não passam pelo AuthGuard do gateway)', () => {
    it('anônimo chega ao serviço', async () => {
      const response = await get(`/${API_PREFIX}/units`);
      const echo = (await response.json()) as UpstreamEcho;

      expect(response.status).toBe(200);
      expect(echo.path).toBe(`/${API_PREFIX}/units`);
      expect(echo.headers.authorization).toBeUndefined();
    });

    it('papel não é decidido no gateway: DONOR em rota de admin chega ao serviço', async () => {
      const response = await get(`/${API_PREFIX}/admin/users`, bearer('token-doador'));
      const echo = (await response.json()) as UpstreamEcho;

      expect(response.status).toBe(200);
      expect(echo.headers.authorization).toBe('Bearer token-doador');
    });

    it('token inválido é barrado na borda (401 TOKEN_INVALID + WWW-Authenticate)', async () => {
      const response = await get(`/${API_PREFIX}/units`, bearer('token-forjado'));

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer error="invalid_token"');
      expect(((await response.json()) as ProblemDetails).code).toBe('TOKEN_INVALID');
    });

    it('chaves indisponíveis na borda → 503 AUTH_UNAVAILABLE, sem WWW-Authenticate', async () => {
      const response = await get(`/${API_PREFIX}/units`, bearer('token-jwks-fora'));

      expect(response.status).toBe(503);
      expect(response.headers.get('www-authenticate')).toBeNull();
      expect((await response.json()) as ProblemDetails).toMatchObject({
        code: 'AUTH_UNAVAILABLE',
        detail: 'Não foi possível validar sua sessão agora. Tente novamente em instantes.',
      });
    });
  });

  describe('x-request-id', () => {
    it('repassa ao serviço o id válido enviado pelo cliente', async () => {
      const response = await get(`/${API_PREFIX}/units`, { 'x-request-id': 'req-cliente-123' });
      const echo = (await response.json()) as UpstreamEcho;

      expect(echo.headers['x-request-id']).toBe('req-cliente-123');
      expect(response.headers.get('x-request-id')).toBe('req-cliente-123');
    });

    it.each(['curto', 'tem espaço 123', 'x'.repeat(129)])(
      'troca id fora do formato (%j) por um UUID, o mesmo na resposta e no serviço',
      async (requestId) => {
        const response = await get(`/${API_PREFIX}/units`, { 'x-request-id': requestId });
        const echo = (await response.json()) as UpstreamEcho;
        const forwarded = echo.headers['x-request-id'];

        expect(forwarded).toMatch(/^[0-9a-f-]{36}$/);
        expect(response.headers.get('x-request-id')).toBe(forwarded);
      },
    );

    it('id vazio também é trocado por um UUID no Problem Details', async () => {
      const response = await get('/rota-que-nao-existe', { 'x-request-id': '' });
      const body = (await response.json()) as ProblemDetails;

      expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.headers.get('x-request-id')).toBe(body.requestId);
    });
  });
});

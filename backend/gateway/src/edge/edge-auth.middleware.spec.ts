import { Logger } from '@nestjs/common';
import { AppException, type TokenVerifier } from '@pulso/common';
import type { AuthUser } from '@pulso/contracts';
import type { Request, Response } from 'express';
import { errors } from 'jose';
import { EdgeAuthMiddleware } from './edge-auth.middleware';

const DONOR: AuthUser = { id: 'u-1', role: 'DONOR', name: 'Doador Fictício', unitIds: [] };

/** Simula as respostas do verificador real (jose + JWKS remoto). */
const verify = jest.fn<Promise<AuthUser>, [string]>(async (token) => {
  switch (token) {
    case 'valido':
      return DONOR;
    case 'vencido':
      throw new errors.JWTExpired('"exp" claim timestamp check failed', {});
    case 'jwks-lento':
      throw new errors.JWKSTimeout();
    case 'jwks-404':
      throw new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response');
    case 'identity-fora':
      throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.2:3001'), {
        code: 'ECONNREFUSED',
      });
    default:
      throw new errors.JWSSignatureVerificationFailed();
  }
});

function run(path: string, authorization?: string) {
  const middleware = new EdgeAuthMiddleware({ verify } as TokenVerifier);
  const request = {
    originalUrl: path,
    headers: authorization ? { authorization } : {},
    id: 'req-12345678',
  } as unknown as Request;
  const setHeader = jest.fn();
  const response = { setHeader } as unknown as Response;
  const next = jest.fn();
  const result = middleware.use(request, response, next).then(
    () => undefined,
    (error: unknown) => error,
  );
  return { result, next, setHeader };
}

describe('EdgeAuthMiddleware', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    verify.mockClear();
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('deixa seguir requisição sem token (o serviço decide o que é público)', async () => {
    const { result, next } = run('/api/v1/units');

    expect(await result).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(verify).not.toHaveBeenCalled();
  });

  it('deixa seguir token válido', async () => {
    const { result, next } = run('/api/v1/users/me', 'Bearer valido');

    expect(await result).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it.each(['/health', '/api/v1/health/services', '/api/v1/auth/refresh', '/api/docs'])(
    'não valida token em %s (rota do gateway ou sem validação de borda)',
    async (path) => {
      const { result, next } = run(path, 'Bearer forjado');

      expect(await result).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it.each(['forjado', 'vencido'])(
    'token %s → 401 TOKEN_INVALID com WWW-Authenticate',
    async (token) => {
      const { result, next, setHeader } = run('/api/v1/users/me', `Bearer ${token}`);
      const error = (await result) as AppException;

      expect(error).toBeInstanceOf(AppException);
      expect(error.getStatus()).toBe(401);
      expect(error.code).toBe('TOKEN_INVALID');
      expect(setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer error="invalid_token"');
      expect(next).not.toHaveBeenCalled();
      expect(errorLog).not.toHaveBeenCalled();
    },
  );

  it.each(['jwks-lento', 'jwks-404', 'identity-fora'])(
    '%s → 503 AUTH_UNAVAILABLE, sem WWW-Authenticate, com a causa registrada como erro',
    async (token) => {
      const { result, next, setHeader } = run('/api/v1/users/me', `Bearer ${token}`);
      const error = (await result) as AppException;

      expect(error.getStatus()).toBe(503);
      expect(error.code).toBe('AUTH_UNAVAILABLE');
      expect(setHeader).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(errorLog).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          requestId: 'req-12345678',
          service: 'identity',
        }),
        expect.any(String),
      );
    },
  );
});

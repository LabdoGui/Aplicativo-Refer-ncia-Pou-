import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { JWT_AUDIENCE, JWT_ISSUER } from '@pulso/contracts';
import { errors, exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose';
import { AppException } from '../errors/app.exception';
import { claimsToUser, LocalKeyTokenVerifier, RemoteJwksTokenVerifier } from './token-verifier';
import {
  classifyVerificationError,
  tokenVerificationException,
  TokenVerificationError,
} from './token-verification-error';

interface KeyPair {
  publicKey: KeyLike;
  privateKey: KeyLike;
}

async function signToken(
  privateKey: KeyLike,
  options: { kid?: string; expiresAt?: number; claims?: Record<string, unknown> } = {},
): Promise<string> {
  return new SignJWT({ role: 'DONOR', name: 'Doador Fictício', ...options.claims })
    .setProtectedHeader({ alg: 'RS256', kid: options.kid ?? 'k1' })
    .setSubject('u-1')
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? '5m')
    .sign(privateKey);
}

/** Servidor JWKS falso: responde o que `respond` decidir. */
async function startJwksServer(
  respond: (send: (status: number, body: string) => void) => void,
): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) =>
    respond((status, body) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(body);
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}/api/v1/.well-known/jwks.json` };
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('a validação deveria falhar');
    },
    (error: unknown) => error,
  );
}

describe('classifyVerificationError', () => {
  it.each([
    ['JWTExpired', new errors.JWTExpired('expirado', {})],
    ['JWTClaimValidationFailed', new errors.JWTClaimValidationFailed('aud', {})],
    ['JWSSignatureVerificationFailed', new errors.JWSSignatureVerificationFailed()],
    ['JWSInvalid', new errors.JWSInvalid()],
    ['JWTInvalid', new errors.JWTInvalid()],
    ['JWKSNoMatchingKey', new errors.JWKSNoMatchingKey()],
    ['JOSEAlgNotAllowed', new errors.JOSEAlgNotAllowed()],
    ['TokenVerificationError(invalid)', new TokenVerificationError('invalid', 'sem claims')],
  ])('%s → invalid', (_label, error) => {
    expect(classifyVerificationError(error)).toBe('invalid');
  });

  it.each([
    ['JWKSTimeout', new errors.JWKSTimeout()],
    ['JWKSInvalid', new errors.JWKSInvalid()],
    ['JOSEError genérico (JWKS não-200)', new errors.JOSEError('Expected 200 OK')],
    ['erro de rede', Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })],
    ['TypeError', new TypeError('Unsupported URL protocol.')],
    ['erro desconhecido', new Error('???')],
    ['valor que não é Error', undefined],
  ])('%s → unavailable', (_label, error) => {
    expect(classifyVerificationError(error)).toBe('unavailable');
  });
});

describe('tokenVerificationException', () => {
  const logger = { error: jest.fn() };

  beforeEach(() => logger.error.mockClear());

  it('credencial inválida → 401 TOKEN_INVALID, sem registrar erro', () => {
    const exception = tokenVerificationException(new errors.JWTExpired('expirado', {}), logger);

    expect(exception).toBeInstanceOf(AppException);
    expect(exception.getStatus()).toBe(401);
    expect(exception.code).toBe('TOKEN_INVALID');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('indisponibilidade → 503 AUTH_UNAVAILABLE com mensagem amigável e a causa registrada', () => {
    const cause = new errors.JWKSTimeout();
    const exception = tokenVerificationException(cause, logger, { requestId: 'req-12345678' });

    expect(exception.getStatus()).toBe(503);
    expect(exception.code).toBe('AUTH_UNAVAILABLE');
    expect(exception.message).toBe(
      'Não foi possível validar sua sessão agora. Tente novamente em instantes.',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: cause, requestId: 'req-12345678' }),
      expect.any(String),
    );
  });
});

describe('verificadores reais (jose) e a classificação dos erros', () => {
  let keys: KeyPair;
  let otherKeys: KeyPair;
  let jwk: JWK;
  const servers: Server[] = [];

  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    otherKeys = await generateKeyPair('RS256');
    jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  });

  afterAll(async () => {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  async function remoteVerifier(respond: Parameters<typeof startJwksServer>[0]) {
    const { server, url } = await startJwksServer(respond);
    servers.push(server);
    return new RemoteJwksTokenVerifier(url);
  }

  it('aceita token válido com a chave do JWKS', async () => {
    const verifier = await remoteVerifier((send) => send(200, JSON.stringify({ keys: [jwk] })));

    await expect(verifier.verify(await signToken(keys.privateKey))).resolves.toMatchObject({
      id: 'u-1',
      role: 'DONOR',
    });
  });

  it('assinatura de outra chave, token vencido ou kid desconhecido → invalid', async () => {
    const verifier = await remoteVerifier((send) => send(200, JSON.stringify({ keys: [jwk] })));
    const tokens = [
      await signToken(otherKeys.privateKey),
      await signToken(keys.privateKey, { expiresAt: Math.floor(Date.now() / 1000) - 60 }),
      await signToken(otherKeys.privateKey, { kid: 'k-desconhecido' }),
      'nem.um-jwt',
    ];

    for (const token of tokens) {
      expect(classifyVerificationError(await failureOf(verifier.verify(token)))).toBe('invalid');
    }
  });

  it('JWKS respondendo 404 → unavailable', async () => {
    const verifier = await remoteVerifier((send) => send(404, '{"code":"NOT_FOUND"}'));

    const error = await failureOf(verifier.verify(await signToken(keys.privateKey)));

    expect(classifyVerificationError(error)).toBe('unavailable');
  });

  it('JWKS com conteúdo inválido → unavailable', async () => {
    const verifier = await remoteVerifier((send) => send(200, '{"chaves":"nenhuma"}'));

    const error = await failureOf(verifier.verify(await signToken(keys.privateKey)));

    expect(classifyVerificationError(error)).toBe('unavailable');
  });

  it('identity fora do ar (conexão recusada) → unavailable', async () => {
    const { server, url } = await startJwksServer((send) => send(200, '{}'));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const verifier = new RemoteJwksTokenVerifier(url);

    const error = await failureOf(verifier.verify(await signToken(keys.privateKey)));

    expect(classifyVerificationError(error)).toBe('unavailable');
  });

  it('chave local: assinatura errada → invalid', async () => {
    const verifier = new LocalKeyTokenVerifier(() => keys.publicKey);

    const error = await failureOf(verifier.verify(await signToken(otherKeys.privateKey)));

    expect(classifyVerificationError(error)).toBe('invalid');
  });

  it('token sem claims obrigatórias → invalid', () => {
    let error: unknown;
    try {
      claimsToUser({ sub: 'u-1', role: 'SUPERUSER' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(TokenVerificationError);
    expect(classifyVerificationError(error)).toBe('invalid');
  });
});

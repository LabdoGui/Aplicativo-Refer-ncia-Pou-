import { createRemoteJWKSet, jwtVerify, type JWTPayload, type KeyLike } from 'jose';
import { JWT_AUDIENCE, JWT_ISSUER, ROLES, type AuthUser, type Role } from '@pulso/contracts';

export interface TokenVerifier {
  verify(token: string): Promise<AuthUser>;
}

export function claimsToUser(payload: JWTPayload): AuthUser {
  const role = payload.role as Role;
  if (typeof payload.sub !== 'string' || !ROLES.includes(role)) {
    throw new Error('Token sem claims obrigatórias');
  }
  return {
    id: payload.sub,
    role,
    name: typeof payload.name === 'string' ? payload.name : '',
    unitIds: Array.isArray(payload.unitIds) ? (payload.unitIds as string[]) : [],
  };
}

const VERIFY_OPTIONS = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  algorithms: ['RS256'],
};

/** Valida tokens com as chaves públicas publicadas pelo identity-service (JWKS, com cache). */
export class RemoteJwksTokenVerifier implements TokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(jwksUrl: string) {
    this.jwks = createRemoteJWKSet(new URL(jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
      timeoutDuration: 3_000,
    });
  }

  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.jwks, VERIFY_OPTIONS);
    return claimsToUser(payload);
  }
}

/** Valida tokens com uma chave pública local (usado pelo próprio identity-service). */
export class LocalKeyTokenVerifier implements TokenVerifier {
  constructor(private readonly getPublicKey: () => KeyLike | Promise<KeyLike>) {}

  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, await this.getPublicKey(), VERIFY_OPTIONS);
    return claimsToUser(payload);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { APP_CONFIG } from '@pulso/common';
import { JWT_AUDIENCE, JWT_ISSUER, type Role } from '@pulso/contracts';
import type { IdentityEnv } from '../config';
import { KeyStore } from '../keys/key-store';

export interface TokenSubject {
  id: string;
  role: Role;
  name: string;
  unitIds: string[];
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly keys: KeyStore,
    @Inject(APP_CONFIG) private readonly config: IdentityEnv,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.config.ACCESS_TOKEN_TTL_SECONDS;
  }

  get refreshTokenTtlMs(): number {
    return this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000;
  }

  /** Access token RS256 de curta duração com sub, papel, nome e unidades. */
  signAccessToken(subject: TokenSubject, sessionId?: string): Promise<string> {
    return new SignJWT({
      role: subject.role,
      name: subject.name,
      ...(subject.unitIds.length > 0 ? { unitIds: subject.unitIds } : {}),
      ...(sessionId ? { sid: sessionId } : {}),
    })
      .setProtectedHeader({ alg: 'RS256', kid: this.keys.kid, typ: 'JWT' })
      .setSubject(subject.id)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.config.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.keys.privateKey);
  }

  /** Refresh token opaco (256 bits); só o hash vai para o banco. */
  newRefreshToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: hashRefreshToken(token) };
  }
}

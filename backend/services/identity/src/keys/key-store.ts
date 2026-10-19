import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { calculateJwkThumbprint, exportJWK, type JWK } from 'jose';
import { loadEnv } from '@pulso/common';
import { envSchema } from '../config';

const PRIVATE_KEY_FILE = 'jwt-private.pem';

export interface PublicJwks {
  keys: JWK[];
}

/** Par de chaves RS256 do JWT e o JWKS publicado para os outros serviços. */
export class KeyStore {
  private constructor(
    readonly privateKey: KeyObject,
    readonly publicKey: KeyObject,
    readonly kid: string,
    readonly jwks: PublicJwks,
  ) {}

  static async fromPrivateKey(privateKey: KeyObject): Promise<KeyStore> {
    const publicKey = createPublicKey(privateKey);
    const jwk = await exportJWK(publicKey);
    const kid = await calculateJwkThumbprint(jwk);
    return new KeyStore(privateKey, publicKey, kid, {
      keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }],
    });
  }

  /**
   * Ordem: JWT_PRIVATE_KEY (PEM) → arquivo em JWT_KEYS_DIR → par novo gravado
   * nessa pasta (permissão 600). Sem persistência, cada reinício derrubaria as sessões.
   */
  static async load(options: { privateKeyPem?: string; keysDir: string }): Promise<KeyStore> {
    const logger = new Logger(KeyStore.name);
    if (options.privateKeyPem) {
      return KeyStore.fromPrivateKey(createPrivateKey(options.privateKeyPem.replace(/\\n/g, '\n')));
    }
    const file = join(options.keysDir, PRIVATE_KEY_FILE);
    if (existsSync(file)) {
      return KeyStore.fromPrivateKey(createPrivateKey(readFileSync(file)));
    }
    mkdirSync(options.keysDir, { recursive: true, mode: 0o700 });
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    chmodSync(file, 0o600);
    logger.log({ dir: options.keysDir }, 'Novo par de chaves do JWT gerado');
    return KeyStore.fromPrivateKey(privateKey);
  }
}

let shared: Promise<KeyStore> | undefined;

/**
 * Instância única do processo. É compartilhada pelo provider do Nest e pelo
 * verificador de tokens do CoreModule (que não enxerga providers de outros módulos).
 */
export function getKeyStore(): Promise<KeyStore> {
  if (!shared) {
    const env = loadEnv(envSchema);
    shared = KeyStore.load({ privateKeyPem: env.JWT_PRIVATE_KEY, keysDir: env.JWT_KEYS_DIR });
  }
  return shared;
}

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

/**
 * Cifragem de campos sensíveis na aplicação (AES-256-GCM).
 * Formato: v1:<iv>:<tag>:<conteúdo>, cada parte em base64.
 * A chave (32 bytes em base64) vem de variável de ambiente; em produção, de um cofre (KMS).
 */
export class FieldEncryption {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) {
      throw new Error('FIELD_ENCRYPTION_KEY deve ter 32 bytes em base64');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const content = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64'), tag.toString('base64'), content.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, content] = payload.split(':');
    if (version !== VERSION || !iv || !tag || !content) {
      throw new Error('Formato de campo cifrado desconhecido');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(content, 'base64')), decipher.final()]).toString('utf8');
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(payload: string): T {
    return JSON.parse(this.decrypt(payload)) as T;
  }
}

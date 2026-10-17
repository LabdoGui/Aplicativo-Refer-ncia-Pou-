import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** Argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, 2 iterações). */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  /** Hash usado quando o e-mail não existe, para o tempo de resposta não revelar contas. */
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Gasta o mesmo tempo de uma verificação real. */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('pulso-dummy-password-1');
    await this.verify(await this.dummyHash, password);
  }
}

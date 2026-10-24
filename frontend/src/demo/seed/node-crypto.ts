/**
 * Substituto de node:crypto no navegador, só com o que o seed compartilhado usa
 * (createHash('sha256') para os UUIDs determinísticos).
 */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new Error(`[demo] hash ${algorithm} não suportado`);
  let input = '';
  const hash = {
    update(data: string) {
      input += data;
      return hash;
    },
    digest(encoding: string) {
      if (encoding !== 'hex') throw new Error(`[demo] digest ${encoding} não suportado`);
      return bytesToHex(sha256(utf8ToBytes(input)));
    },
  };
  return hash;
}

export function randomUUID(): string {
  return crypto.randomUUID();
}

export function randomInt(max: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

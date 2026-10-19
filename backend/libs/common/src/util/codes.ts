import { randomInt } from 'node:crypto';

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para códigos lidos por pessoas. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Código legível e aleatório, ex.: humanCode('AG') → "AG-7K3M9P". */
export function humanCode(prefix: string, length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${code}`;
}

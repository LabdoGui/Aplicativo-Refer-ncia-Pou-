import { createHash, randomInt } from 'node:crypto';

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const PREFIX = 'PUL';
const GROUP = 5;
const LENGTH = GROUP * 2;

/** Código de verificação legível, ex.: PUL-7K3M9-QX2TB (~49 bits aleatórios). */
export function newVerificationCode(): string {
  let random = '';
  for (let i = 0; i < LENGTH; i++) random += ALPHABET[randomInt(ALPHABET.length)];
  return `${PREFIX}-${random.slice(0, GROUP)}-${random.slice(GROUP)}`;
}

/**
 * Forma canônica para busca: maiúsculas, só letras e números ("pul 7k3m9-qx2tb"
 * → "PUL7K3M9QX2TB"). Devolve null quando o formato não pode ser um código.
 */
export function canonicalCode(input: string): string | null {
  const value = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pattern = new RegExp(`^${PREFIX}[${ALPHABET}]{${LENGTH}}$`);
  return pattern.test(value) ? value : null;
}

/** SHA-256 da forma canônica (é o que fica indexado no banco). */
export function hashVerificationCode(code: string): string {
  const canonical = canonicalCode(code);
  if (!canonical) throw new Error('Código de verificação inválido');
  return createHash('sha256').update(canonical).digest('hex');
}

/** Conectivos que não entram nas iniciais. */
const CONNECTIVES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** Iniciais do titular, ex.: "Mariana Alves de Souza" → "M. A. S." */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((part) => part && !CONNECTIVES.has(part.toLowerCase()))
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join(' ');
}

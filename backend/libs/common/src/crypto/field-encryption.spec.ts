import { randomBytes } from 'node:crypto';
import { FieldEncryption } from './field-encryption';

const newKey = (bytes = 32) => randomBytes(bytes).toString('base64');

/** Substitui uma parte (0 = versão, 1 = iv, 2 = tag, 3 = conteúdo) do valor cifrado. */
function replacePart(payload: string, index: number, change: (value: Buffer) => Buffer): string {
  const parts = payload.split(':');
  parts[index] = change(Buffer.from(parts[index], 'base64')).toString('base64');
  return parts.join(':');
}

function flipFirstByte(value: Buffer): Buffer {
  const copy = Buffer.from(value);
  copy[0] ^= 0xff;
  return copy;
}

describe('FieldEncryption', () => {
  const encryption = new FieldEncryption(newKey());

  it('cifra e decifra texto (ida e volta), inclusive com acentos', () => {
    const plaintext = 'Respostas da pré-triagem: não, sim, às vezes ❤';
    const payload = encryption.encrypt(plaintext);

    expect(payload).not.toContain('pré-triagem');
    expect(payload).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(encryption.decrypt(payload)).toBe(plaintext);
  });

  it('cifra e decifra texto vazio', () => {
    expect(encryption.decrypt(encryption.encrypt(''))).toBe('');
  });

  it('cifra e decifra JSON (ida e volta)', () => {
    const value = { etapa: 2, respostas: { q1: true, q2: 'não' }, lista: [1, 2, 3], nulo: null };

    expect(encryption.decryptJson(encryption.encryptJson(value))).toEqual(value);
  });

  it('usa IV aleatório: duas cifragens do mesmo texto são diferentes', () => {
    const first = encryption.encrypt('mesmo texto');
    const second = encryption.encrypt('mesmo texto');

    expect(first).not.toBe(second);
    expect(first.split(':')[1]).not.toBe(second.split(':')[1]);
    expect(encryption.decrypt(first)).toBe(encryption.decrypt(second));
  });

  it('rejeita conteúdo adulterado', () => {
    const tampered = replacePart(encryption.encrypt('dado sensível'), 3, flipFirstByte);

    expect(() => encryption.decrypt(tampered)).toThrow();
  });

  it('rejeita IV ou tag de autenticação adulterados', () => {
    const payload = encryption.encrypt('dado sensível');

    expect(() => encryption.decrypt(replacePart(payload, 1, flipFirstByte))).toThrow();
    expect(() => encryption.decrypt(replacePart(payload, 2, flipFirstByte))).toThrow();
  });

  it('rejeita tag de autenticação truncada', () => {
    const truncated = replacePart(encryption.encrypt('dado sensível'), 2, (tag) =>
      tag.subarray(0, 4),
    );

    expect(() => encryption.decrypt(truncated)).toThrow();
  });

  it('não decifra com outra chave', () => {
    const payload = encryption.encrypt('dado sensível');

    expect(() => new FieldEncryption(newKey()).decrypt(payload)).toThrow();
  });

  it.each([
    ['texto puro', 'não cifrado'],
    ['versão desconhecida', 'v2:aaaa:bbbb:cccc'],
    ['partes faltando', 'v1:aaaa:bbbb'],
    ['partes a mais', 'v1:aaaa:bbbb:cccc:dddd'],
  ])('rejeita formato inválido (%s)', (_label, payload) => {
    expect(() => encryption.decrypt(payload)).toThrow('Formato de campo cifrado desconhecido');
  });

  it.each([16, 24, 31, 33, 0])('rejeita chave com %i bytes', (bytes) => {
    expect(() => new FieldEncryption(newKey(bytes))).toThrow(
      'FIELD_ENCRYPTION_KEY deve ter 32 bytes em base64',
    );
  });
});

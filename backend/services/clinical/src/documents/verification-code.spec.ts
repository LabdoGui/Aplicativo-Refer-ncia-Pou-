import {
  canonicalCode,
  hashVerificationCode,
  initialsOf,
  newVerificationCode,
} from './verification-code';

describe('códigos de verificação', () => {
  it('gera códigos no formato PUL-XXXXX-XXXXX, sem caracteres ambíguos', () => {
    const codes = new Set(Array.from({ length: 200 }, () => newVerificationCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^PUL-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
  });

  it('normaliza maiúsculas, espaços e hífens antes do hash', () => {
    const code = newVerificationCode();
    const messy = ` ${code.toLowerCase().replace(/-/g, ' ')} `;
    expect(canonicalCode(messy)).toBe(code.replace(/-/g, ''));
    expect(hashVerificationCode(messy)).toBe(hashVerificationCode(code));
    expect(hashVerificationCode(code)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('recusa formatos impossíveis', () => {
    expect(canonicalCode('PUL-00000-00000')).toBeNull();
    expect(canonicalCode('ABC')).toBeNull();
    expect(canonicalCode("PUL-AAAAA-AAAAA' OR 1=1")).toBeNull();
    expect(() => hashVerificationCode('nada')).toThrow();
  });

  it('monta as iniciais sem os conectivos', () => {
    expect(initialsOf('Mariana Alves de Souza')).toBe('M. A. S.');
    expect(initialsOf('  joão  da silva ')).toBe('J. S.');
  });
});

import { loadEnv } from '@pulso/common';
import { envSchema } from './config';

const BASE_ENV = {
  PORT: '3000',
  INTERNAL_API_TOKEN: 'token-interno-de-teste-123',
  JWKS_URL: 'http://identity:3001/api/v1/.well-known/jwks.json',
  IDENTITY_URL: 'http://identity:3001',
  SCHEDULING_URL: 'http://scheduling:3002',
  CLINICAL_URL: 'http://clinical:3003',
  INVENTORY_URL: 'http://inventory:3004',
  ENGAGEMENT_URL: 'http://engagement:3005',
  NOTIFICATION_URL: 'http://notification:3006',
};

describe('envSchema do gateway › DOCS_ENABLED', () => {
  it('liga a documentação por padrão', () => {
    expect(loadEnv(envSchema, BASE_ENV).DOCS_ENABLED).toBe(true);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('aceita "%s"', (value, expected) => {
    expect(loadEnv(envSchema, { ...BASE_ENV, DOCS_ENABLED: value }).DOCS_ENABLED).toBe(expected);
  });

  it('recusa outros valores com mensagem legível', () => {
    expect(() => loadEnv(envSchema, { ...BASE_ENV, DOCS_ENABLED: 'nao' })).toThrow(/DOCS_ENABLED/);
  });
});

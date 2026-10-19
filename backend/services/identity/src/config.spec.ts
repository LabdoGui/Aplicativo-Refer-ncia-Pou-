import { loadEnv } from '@pulso/common';
import { envSchema } from './config';

const base = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/pulso?schema=identity',
  RABBITMQ_URL: 'amqp://u:p@localhost:5672',
  INTERNAL_API_TOKEN: 'token-interno-de-teste-123',
  JWKS_URL: 'http://localhost:3001/api/v1/.well-known/jwks.json',
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('envSchema (identity)', () => {
  it('variáveis do administrador inicial vazias contam como não informadas', () => {
    const env = loadEnv(envSchema, {
      ...base,
      BOOTSTRAP_ADMIN_EMAIL: '',
      BOOTSTRAP_ADMIN_PASSWORD: '',
    });
    expect(env.BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
  });

  it('exige e-mail e senha do administrador inicial juntos', () => {
    expect(() =>
      loadEnv(envSchema, { ...base, BOOTSTRAP_ADMIN_EMAIL: 'admin@exemplo.org' }),
    ).toThrow(/juntos/);
  });

  it('aplica a política de senha ao administrador inicial', () => {
    expect(() =>
      loadEnv(envSchema, {
        ...base,
        BOOTSTRAP_ADMIN_EMAIL: 'admin@exemplo.org',
        BOOTSTRAP_ADMIN_PASSWORD: 'curta',
      }),
    ).toThrow(/Configuração inválida/);
  });
});

import { z } from 'zod';
import { baseEnvSchema, loadEnv, serviceEnvSchema } from './env';

const VALID_BASE = {
  PORT: '3002',
  INTERNAL_API_TOKEN: 'dev-internal-token-change-me',
  JWKS_URL: 'http://localhost:3001/api/v1/.well-known/jwks.json',
};

const VALID_SERVICE = {
  ...VALID_BASE,
  DATABASE_URL: 'postgresql://scheduling_app:senha@localhost:5432/pulso?schema=scheduling',
  RABBITMQ_URL: 'amqp://pulso:pulso_dev@localhost:5672',
};

describe('loadEnv', () => {
  it('aceita um ambiente válido e converte tipos', () => {
    const env = loadEnv(serviceEnvSchema, VALID_SERVICE);

    expect(env.PORT).toBe(3002);
    expect(env.DATABASE_URL).toBe(VALID_SERVICE.DATABASE_URL);
    expect(env.RABBITMQ_URL).toBe(VALID_SERVICE.RABBITMQ_URL);
  });

  it('aplica os valores padrão quando as variáveis opcionais faltam', () => {
    const env = loadEnv(baseEnvSchema, VALID_BASE);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      LOG_PRETTY: false,
      SERVICE_VERSION: '0.1.0',
    });
  });

  it('respeita valores explícitos e converte LOG_PRETTY para booleano', () => {
    const env = loadEnv(baseEnvSchema, {
      ...VALID_BASE,
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      LOG_PRETTY: 'true',
      SERVICE_VERSION: '1.2.3',
    });

    expect(env).toMatchObject({
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      LOG_PRETTY: true,
      SERVICE_VERSION: '1.2.3',
    });
  });

  it('rejeita ambiente inválido com mensagem legível listando cada problema', () => {
    const invalid = { ...VALID_SERVICE, PORT: 'abc', INTERNAL_API_TOKEN: 'curto' };

    expect(() => loadEnv(serviceEnvSchema, invalid)).toThrow(/^Configuração inválida: /);
    expect(() => loadEnv(serviceEnvSchema, invalid)).toThrow(/PORT: /);
    expect(() => loadEnv(serviceEnvSchema, invalid)).toThrow(
      /INTERNAL_API_TOKEN: deve ter ao menos 16 caracteres/,
    );
  });

  it('rejeita variáveis obrigatórias ausentes', () => {
    const { JWKS_URL: _omit, ...withoutJwks } = VALID_BASE;

    expect(() => loadEnv(baseEnvSchema, withoutJwks)).toThrow(/JWKS_URL: /);
  });

  it('rejeita URLs de banco e broker com protocolo errado', () => {
    const invalid = {
      ...VALID_SERVICE,
      DATABASE_URL: 'mysql://usuario@localhost/pulso',
      RABBITMQ_URL: 'http://localhost:5672',
    };

    expect(() => loadEnv(serviceEnvSchema, invalid)).toThrow(/DATABASE_URL: .*RABBITMQ_URL: /);
  });

  it('rejeita valores fora dos enums', () => {
    expect(() => loadEnv(baseEnvSchema, { ...VALID_BASE, LOG_LEVEL: 'verbose' })).toThrow(
      /LOG_LEVEL: /,
    );
  });

  it('identifica erros na raiz do objeto', () => {
    expect(() => loadEnv(z.string(), {})).toThrow('Configuração inválida: (raiz): ');
  });

  it('lê process.env quando nenhuma fonte é informada', () => {
    const keys = Object.keys(VALID_BASE);
    const backup = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    try {
      Object.assign(process.env, VALID_BASE, { PORT: '4321' });
      expect(loadEnv(baseEnvSchema).PORT).toBe(4321);
    } finally {
      for (const key of keys) {
        if (backup[key] === undefined) delete process.env[key];
        else process.env[key] = backup[key];
      }
    }
  });
});

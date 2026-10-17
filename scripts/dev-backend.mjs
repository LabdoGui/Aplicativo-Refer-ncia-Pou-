#!/usr/bin/env node
/**
 * Sobe o gateway e os 6 serviços localmente, a partir das pastas dist/, usando
 * o PostgreSQL e o RabbitMQ do Docker (npm run infra:up). Ctrl+C encerra tudo.
 *
 * Pré-requisitos:
 *   npm run infra:up      # só banco e broker
 *   npm run build         # libs, serviços (prisma generate) e gateway
 *
 * Uso:
 *   node scripts/dev-backend.mjs                      # todos os processos
 *   node scripts/dev-backend.mjs --only=identity,gateway
 *
 * As variáveis vêm do .env da raiz (opcional) com os mesmos padrões do
 * docker-compose.yml; só os endereços mudam para localhost.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Socket } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GRACE_PERIOD_MS = 3_000;
const FORCE_KILL_AFTER_MS = 10_000;

const envFile = join(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const env = (name, fallback) => process.env[name] || fallback;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const COLORS = ['36', '35', '33', '32', '34', '91', '96'];
const paint = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const log = (message) => console.log(paint('1', `[dev-backend] ${message}`));

/** Portas e nomes vêm de @pulso/contracts (compilado por npm run build). */
function loadContracts() {
  const entry = join(ROOT, 'backend/libs/contracts/dist/index.js');
  if (!existsSync(entry)) {
    log('Não encontrei backend/libs/contracts/dist. Rode antes: npm run build');
    process.exit(1);
  }
  return createRequire(import.meta.url)(entry);
}

const { SERVICES, SERVICE_NAMES, GATEWAY_DEFAULT_PORT, API_PREFIX } = loadContracts();

const infra = {
  postgresPort: env('POSTGRES_PORT', '5432'),
  database: env('POSTGRES_DB', 'pulso'),
  // Banco de sombra do "prisma migrate dev", criado por database/init/01-init.sh.
  shadowDatabase: 'pulso_shadow',
  rabbitPort: env('RABBITMQ_PORT', '5672'),
  rabbitUser: env('RABBITMQ_USER', 'pulso'),
  rabbitPassword: env('RABBITMQ_PASSWORD', 'pulso_dev'),
};

const sharedEnv = {
  NODE_ENV: 'development',
  LOG_LEVEL: env('LOG_LEVEL', 'info'),
  LOG_PRETTY: env('LOG_PRETTY', 'true'),
  INTERNAL_API_TOKEN: env('INTERNAL_API_TOKEN', 'pulso-dev-internal-token-troque-em-producao'),
  JWKS_URL: `http://localhost:${SERVICES.identity.defaultPort}/${API_PREFIX}/.well-known/jwks.json`,
};

/** Endereços das rotas /internal entre serviços (IDENTITY_URL, SCHEDULING_URL...). */
const serviceUrls = Object.fromEntries(
  SERVICE_NAMES.map((name) => [
    `${name.toUpperCase()}_URL`,
    `http://localhost:${SERVICES[name].defaultPort}`,
  ]),
);

/** Variáveis próprias de alguns serviços (mesmos padrões do docker-compose.yml). */
const serviceSpecificEnv = {
  identity: {
    FIELD_ENCRYPTION_KEY: env(
      'IDENTITY_FIELD_ENCRYPTION_KEY',
      'cHVsc28tZGV2LWlkZW50aXR5LWtleS0zMmJ5dGVzISE=',
    ),
    // Chaves do JWT em backend/services/identity/.keys (fora do git).
    JWT_KEYS_DIR: '.keys',
    COOKIE_SECURE: env('COOKIE_SECURE', 'false'),
  },
  clinical: {
    FIELD_ENCRYPTION_KEY: env(
      'CLINICAL_FIELD_ENCRYPTION_KEY',
      'cHVsc28tZGV2LWNsaW5pY2FsLWtleS0zMmJ5dGVzISE=',
    ),
  },
};

function serviceProcess(name) {
  const password = env(`${name.toUpperCase()}_DB_PASSWORD`, `${name}_dev_password`);
  const postgresUrl = (database) =>
    `postgresql://${name}_app:${password}@localhost:${infra.postgresPort}/${database}?schema=${name}`;
  return {
    name,
    dir: `backend/services/${name}`,
    env: {
      ...sharedEnv,
      PORT: String(SERVICES[name].defaultPort),
      DATABASE_URL: postgresUrl(infra.database),
      SHADOW_DATABASE_URL: postgresUrl(infra.shadowDatabase),
      RABBITMQ_URL: `amqp://${infra.rabbitUser}:${infra.rabbitPassword}@localhost:${infra.rabbitPort}`,
      SEED_DEMO_DATA: env('SEED_DEMO_DATA', 'true'),
      ...serviceUrls,
      ...serviceSpecificEnv[name],
    },
  };
}

function gatewayProcess() {
  const upstreams = Object.fromEntries(
    SERVICE_NAMES.map((name) => [
      `${name.toUpperCase()}_URL`,
      `http://localhost:${SERVICES[name].defaultPort}`,
    ]),
  );
  return {
    name: 'gateway',
    dir: 'backend/gateway',
    env: {
      ...sharedEnv,
      ...upstreams,
      PORT: String(GATEWAY_DEFAULT_PORT),
      CORS_ORIGINS: env('CORS_ORIGINS', 'http://localhost:5173,http://localhost:8080'),
      RATE_LIMIT_WINDOW_MS: env('RATE_LIMIT_WINDOW_MS', '60000'),
      RATE_LIMIT_MAX: env('RATE_LIMIT_MAX', '300'),
      AUTH_RATE_LIMIT_MAX: env('AUTH_RATE_LIMIT_MAX', '20'),
    },
  };
}

function selectProcesses() {
  const all = [...SERVICE_NAMES.map(serviceProcess), gatewayProcess()];
  const flag = process.argv.find((arg) => arg.startsWith('--only='));
  if (!flag) return all;
  const wanted = flag
    .slice('--only='.length)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const unknown = wanted.filter((name) => !all.some((proc) => proc.name === name));
  if (unknown.length > 0) {
    log(
      `Processo desconhecido: ${unknown.join(', ')}. Opções: ${all.map((proc) => proc.name).join(', ')}`,
    );
    process.exit(1);
  }
  return all.filter((proc) => wanted.includes(proc.name));
}

/** Avisa (sem impedir) se o banco ou o broker não respondem. */
function checkPort(label, port) {
  return new Promise((resolvePromise) => {
    const socket = new Socket();
    const done = (ok) => {
      socket.destroy();
      if (!ok)
        log(`Aviso: ${label} não responde em localhost:${port}. Rode antes: npm run infra:up`);
      resolvePromise(ok);
    };
    socket.setTimeout(1_500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(Number(port), '127.0.0.1');
  });
}

const children = new Map();
let shuttingDown = false;

function pipeWithPrefix(stream, prefix, target) {
  createInterface({ input: stream }).on('line', (line) => target.write(`${prefix} ${line}\n`));
}

function start(proc, index) {
  const width = 12;
  const prefix = paint(COLORS[index % COLORS.length], `${proc.name.padEnd(width)}│`);
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: join(ROOT, proc.dir),
    env: { ...process.env, ...proc.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.set(proc.name, child);
  pipeWithPrefix(child.stdout, prefix, process.stdout);
  pipeWithPrefix(child.stderr, prefix, process.stderr);
  child.on('exit', (code, signal) => {
    children.delete(proc.name);
    const reason = signal ? `sinal ${signal}` : `código ${code}`;
    if (!shuttingDown) log(`${proc.name} encerrou (${reason}). Os demais continuam rodando.`);
    if (children.size === 0) {
      log(shuttingDown ? 'Todos os processos foram encerrados.' : 'Nenhum processo em execução.');
      process.exit(shuttingDown ? 0 : 1);
    }
  });
}

function signalAll(signal) {
  for (const child of children.values()) child.kill(signal);
}

function shutdown(signal) {
  if (shuttingDown) {
    log('Encerramento forçado.');
    signalAll('SIGKILL');
    return;
  }
  shuttingDown = true;
  log(`Encerrando ${children.size} processo(s)... (Ctrl+C de novo força o encerramento)`);
  // Com Ctrl+C o terminal já envia SIGINT aos filhos; reenviar na hora poderia
  // interromper o encerramento gracioso do Nest. Os que sobrarem recebem SIGTERM.
  if (signal === 'SIGINT') setTimeout(() => signalAll('SIGTERM'), GRACE_PERIOD_MS).unref();
  else signalAll('SIGTERM');
  setTimeout(() => signalAll('SIGKILL'), FORCE_KILL_AFTER_MS).unref();
}

async function main() {
  const selected = selectProcesses();
  const missing = selected.filter((proc) => !existsSync(join(ROOT, proc.dir, 'dist/main.js')));
  if (missing.length > 0) {
    for (const proc of missing) log(`Falta ${proc.dir}/dist/main.js.`);
    log('Rode antes: npm run build');
    process.exit(1);
  }

  if (selected.some((proc) => proc.name !== 'gateway')) {
    await Promise.all([
      checkPort('PostgreSQL', infra.postgresPort),
      checkPort('RabbitMQ', infra.rabbitPort),
    ]);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('exit', () => signalAll('SIGKILL'));

  log(`Iniciando: ${selected.map((proc) => proc.name).join(', ')}`);
  selected.forEach(start);
  if (selected.some((proc) => proc.name === 'gateway')) {
    log(`Gateway: http://localhost:${GATEWAY_DEFAULT_PORT}/${API_PREFIX}/health/services`);
    log(`Documentação da API: http://localhost:${GATEWAY_DEFAULT_PORT}/api/docs`);
  }
}

void main();

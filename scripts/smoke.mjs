#!/usr/bin/env node
/**
 * Smoke test do ambiente do SangueConecta (Node 22, sem dependências).
 *
 * Confere, pela mesma porta que o navegador usa (nginx), se o frontend, o
 * gateway, os 6 serviços, o banco, o broker e a documentação estão no ar.
 * Espera o ambiente ficar pronto antes de reprovar.
 *
 * Uso:
 *   node scripts/smoke.mjs [--timeout=180]
 *
 * Variáveis:
 *   BASE_URL       endereço do nginx (padrão: http://localhost:8080)
 *   SMOKE_TIMEOUT  espera máxima, em segundos (padrão: 120)
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const TIMEOUT_SECONDS = readTimeout();
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_INTERVAL_MS = 3_000;
const EXPECTED_SERVICES = [
  'identity',
  'scheduling',
  'clinical',
  'inventory',
  'engagement',
  'notification',
];

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = paint('32');
const red = paint('31');
const yellow = paint('33');
const dim = paint('2');
const bold = paint('1');

function readTimeout() {
  const flag = process.argv.find((arg) => arg.startsWith('--timeout='));
  const raw = flag ? flag.split('=')[1] : (process.env.SMOKE_TIMEOUT ?? '120');
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(`Tempo de espera inválido: "${raw}". Use um número de segundos.`);
    process.exit(2);
  }
  return value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Descreve um erro de rede de forma legível. */
function describeNetworkError(error) {
  const code = error?.cause?.code ?? error?.code;
  if (error?.name === 'TimeoutError') return `sem resposta em ${REQUEST_TIMEOUT_MS / 1000} s`;
  if (code === 'ECONNREFUSED') return 'conexão recusada (o contêiner está no ar?)';
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') return 'conexão interrompida';
  if (code === 'ENOTFOUND') return 'endereço não encontrado';
  return error?.message ?? String(error);
}

/** GET simples; nunca lança erro: devolve { error } em falha de rede. */
async function get(path) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'x-request-id': `smoke-${Date.now().toString(36)}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      text,
      json,
      ms: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return { error: describeNetworkError(error) };
  }
}

// ---------------------------------------------------------------------------
// Verificações: cada uma devolve { ok, summary, details? }
// ---------------------------------------------------------------------------

async function checkFrontend() {
  const res = await get('/');
  if (res.error) return { ok: false, summary: `GET / falhou: ${res.error}` };
  if (res.status !== 200) return { ok: false, summary: `GET / respondeu ${res.status}` };
  if (!res.contentType.includes('text/html')) {
    return {
      ok: false,
      summary: `GET / não devolveu HTML (Content-Type: ${res.contentType || 'ausente'})`,
    };
  }
  if (!res.text.includes('SangueConecta'))
    return { ok: false, summary: 'o HTML de GET / não contém "SangueConecta"' };
  return { ok: true, summary: `GET / devolve o HTML do SangueConecta (${res.ms} ms)` };
}

async function checkServicesHealth() {
  const res = await get('/api/v1/health/services');
  if (res.error) return { ok: false, summary: `GET /api/v1/health/services falhou: ${res.error}` };
  if (!res.json || !Array.isArray(res.json.services)) {
    return {
      ok: false,
      summary: `GET /api/v1/health/services respondeu ${res.status} sem o JSON esperado`,
    };
  }

  const byName = new Map(res.json.services.map((service) => [service.name, service]));
  const details = [];
  let healthy = 0;
  for (const name of EXPECTED_SERVICES) {
    const service = byName.get(name);
    if (!service) {
      details.push(`${red('ausente')} ${name.padEnd(13)} não aparece na resposta do gateway`);
      continue;
    }
    const checks = service.checks ?? {};
    const ok = service.status === 'up' && checks.database === 'up' && checks.broker === 'up';
    if (ok) healthy += 1;
    const deps = `banco=${checks.database ?? '?'} broker=${checks.broker ?? '?'}`;
    const latency = service.latencyMs == null ? '' : dim(` ${service.latencyMs} ms`);
    details.push(`${ok ? green('no ar  ') : red('fora   ')} ${name.padEnd(13)} ${deps}${latency}`);
  }

  const ok = res.json.status === 'up' && healthy === EXPECTED_SERVICES.length;
  const summary = ok
    ? `${healthy}/${EXPECTED_SERVICES.length} serviços no ar, com banco e broker conectados`
    : `${healthy}/${EXPECTED_SERVICES.length} serviços prontos (estado geral: ${res.json.status ?? 'desconhecido'})`;
  return { ok, summary, details };
}

async function checkApiDocs() {
  const res = await get('/api/docs-json');
  if (res.error) return { ok: false, summary: `GET /api/docs-json falhou: ${res.error}` };
  const version = res.json?.openapi;
  if (res.status !== 200 || typeof version !== 'string' || typeof res.json.paths !== 'object') {
    return {
      ok: false,
      summary: `GET /api/docs-json respondeu ${res.status} sem um documento OpenAPI`,
    };
  }
  const routes = Object.keys(res.json.paths).length;
  return {
    ok: true,
    summary: `GET /api/docs-json devolve OpenAPI ${version} com ${routes} ${routes === 1 ? 'rota' : 'rotas'}`,
  };
}

async function checkProblemDetails() {
  const res = await get('/api/v1/rota-inexistente');
  if (res.error) return { ok: false, summary: `GET /api/v1/rota-inexistente falhou: ${res.error}` };
  if (!res.contentType.includes('application/problem+json')) {
    return {
      ok: false,
      summary: `rota inexistente respondeu ${res.status} com Content-Type "${res.contentType || 'ausente'}"`,
    };
  }
  if (res.status !== 404 || res.json?.status !== 404) {
    return { ok: false, summary: `rota inexistente respondeu ${res.status} (esperado: 404)` };
  }
  return {
    ok: true,
    summary: 'rota inexistente devolve 404 em application/problem+json (RFC 9457)',
  };
}

const CHECKS = [
  { title: 'Frontend', run: checkFrontend },
  { title: 'Saúde', run: checkServicesHealth },
  { title: 'Documentação', run: checkApiDocs },
  { title: 'Erros da API', run: checkProblemDetails },
];

// ---------------------------------------------------------------------------
// Execução com espera
// ---------------------------------------------------------------------------

/** Repete a verificação até passar ou até o prazo global acabar. */
async function runWithRetry(check, deadline) {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const result = await check.run();
    const remainingMs = deadline - Date.now();
    if (result.ok || remainingMs <= 0) return result;
    if (attempt === 1 || attempt % 5 === 0) {
      const remaining = Math.ceil(remainingMs / 1000);
      console.log(
        dim(
          `       aguardando ${check.title.toLowerCase()} — ${result.summary} (até ${remaining} s)`,
        ),
      );
    }
    await sleep(Math.min(RETRY_INTERVAL_MS, Math.max(remainingMs, 0)));
  }
}

async function main() {
  const startedAt = Date.now();
  const deadline = startedAt + TIMEOUT_SECONDS * 1000;
  console.log(bold('SangueConecta — smoke test'));
  console.log(dim(`Alvo: ${BASE_URL} · espera máxima: ${TIMEOUT_SECONDS} s\n`));

  let failures = 0;
  for (const check of CHECKS) {
    const result = await runWithRetry(check, deadline);
    if (!result.ok) failures += 1;
    const label = result.ok ? green('[ OK ]') : red('[FALHA]');
    console.log(`${label} ${bold(check.title)}: ${result.summary}`);
    for (const line of result.details ?? []) console.log(`         ${line}`);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1).replace('.', ',');
  console.log('');
  if (failures === 0) {
    console.log(
      green(`Resultado: todas as ${CHECKS.length} verificações passaram em ${elapsed} s.`),
    );
    return 0;
  }
  console.log(
    red(`Resultado: ${failures} de ${CHECKS.length} verificações falharam (${elapsed} s).`),
  );
  console.log(
    yellow('Dica: veja os logs com "docker compose ps" e "docker compose logs <serviço>".'),
  );
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(red(`Erro inesperado no smoke test: ${error?.stack ?? error}`));
    process.exit(1);
  },
);

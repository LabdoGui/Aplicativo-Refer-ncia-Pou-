#!/usr/bin/env node
/**
 * Teste de carga leve do Pulso (Node 22, sem dependências): dispara requisições
 * concorrentes nas rotas mais usadas pelo doador e mede latência (p50/p95/p99),
 * vazão e erros. Passa se não houver 5xx/falhas de rede e o p95 ficar abaixo
 * do limite.
 *
 * O gateway limita requisições por IP (RATE_LIMIT_MAX, padrão 300/min). As
 * respostas 429 são contadas à parte: mostram o limite funcionando. Para medir
 * só desempenho, suba o gateway com um limite maior:
 *   RATE_LIMIT_MAX=5000 docker compose up -d gateway
 *
 * Uso:
 *   node scripts/load-test.mjs [--requests=600] [--concurrency=20] [--p95=500]
 */
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;
const arg = (name, fallback) =>
  Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const TOTAL = arg('requests', 600);
const CONCURRENCY = arg('concurrency', 20);
const P95_LIMIT_MS = arg('p95', 500);

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'doador@demo.com', password: 'Pulso@2026' }),
}).then((r) => r.json());
const token = login.accessToken;
const units = await fetch(`${API}/units`).then((r) => r.json());
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);
const inTwoWeeks = new Date(Date.parse(`${today}T12:00:00Z`) + 14 * 86_400_000)
  .toISOString()
  .slice(0, 10);

/** Mistura de rotas de leitura de uma sessão típica de doador. */
const SCENARIO = [
  { name: 'GET /units', path: '/units' },
  { name: 'GET /campaigns', path: '/campaigns' },
  {
    name: 'GET /appointments/availability',
    path: `/appointments/availability?unitId=${units[0].id}&from=${today}&to=${inTwoWeeks}`,
  },
  { name: 'GET /appointments/me', path: '/appointments/me', auth: true },
  { name: 'GET /gamification/profile', path: '/gamification/profile', auth: true },
  { name: 'GET /notifications/unread-count', path: '/notifications/unread-count', auth: true },
  { name: 'GET /dashboard/public-stats', path: '/dashboard/public-stats' },
];

const samples = [];
let next = 0;

async function worker() {
  while (next < TOTAL) {
    const index = next++;
    const route = SCENARIO[index % SCENARIO.length];
    const started = performance.now();
    let status = 0;
    try {
      const response = await fetch(`${API}${route.path}`, {
        headers: route.auth ? { authorization: `Bearer ${token}` } : {},
      });
      await response.arrayBuffer();
      status = response.status;
    } catch {
      status = 0;
    }
    samples.push({ route: route.name, status, ms: performance.now() - started });
  }
}

const startedAt = performance.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const seconds = (performance.now() - startedAt) / 1000;

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};
const ok = samples.filter((s) => s.status >= 200 && s.status < 400);
const limited = samples.filter((s) => s.status === 429).length;
const failed = samples.filter((s) => s.status === 0 || s.status >= 500).length;
const latencies = ok.map((s) => s.ms);

console.log(`Teste de carga em ${BASE_URL}: ${TOTAL} requisições, ${CONCURRENCY} simultâneas\n`);
for (const route of SCENARIO) {
  const own = ok.filter((s) => s.route === route.name).map((s) => s.ms);
  if (own.length === 0) continue;
  console.log(
    `  ${route.name.padEnd(34)} p50 ${percentile(own, 50).toFixed(0).padStart(4)} ms  p95 ${percentile(own, 95).toFixed(0).padStart(4)} ms`,
  );
}
const p95 = percentile(latencies, 95);
console.log(`
  vazão: ${(samples.length / seconds).toFixed(1)} req/s em ${seconds.toFixed(1)} s
  sucesso: ${ok.length}  limitadas (429): ${limited}  falhas (5xx/rede): ${failed}
  latência geral: p50 ${percentile(latencies, 50).toFixed(0)} ms · p95 ${p95.toFixed(0)} ms · p99 ${percentile(latencies, 99).toFixed(0)} ms`);

const passed = failed === 0 && p95 <= P95_LIMIT_MS;
console.log(`\n${passed ? '✔' : '✘'} critério: sem falhas e p95 ≤ ${P95_LIMIT_MS} ms`);
process.exit(passed ? 0 : 1);

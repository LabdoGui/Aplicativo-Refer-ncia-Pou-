#!/usr/bin/env node
/**
 * Matriz de autorização do Pulso pela API real: cada papel (anônimo, doador,
 * colaborador, enfermeiro e administrador) contra rotas representativas de
 * todos os serviços, mais acesso a recursos de outro doador (IDOR), escopo
 * por unidade, segregação de funções (D10) e token adulterado.
 *
 * "permitido" = a autorização passou (qualquer status que não seja 401/403;
 * um 400 de validação ou 404 de recurso inexistente contam como permitido).
 *
 * Pré-requisito: pilha no ar com os dados de demonstração.
 * Uso: node scripts/authz-matrix.mjs   (BASE_URL=http://localhost:3000 para o gateway direto)
 */
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;
const PASSWORD = 'Pulso@2026';
const RANDOM_ID = '00000000-0000-4000-8000-000000000000';

async function request(method, path, token, body) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function login(email, password = PASSWORD) {
  const { status, data } = await request('POST', '/auth/login', undefined, { email, password });
  if (status !== 200) throw new Error(`login de ${email} falhou (${status})`);
  return data.accessToken;
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);
const tokens = {
  anon: undefined,
  donor: await login('doador@demo.com'),
  collaborator: await login('colaborador@demo.com'),
  nurse: await login('enfermeiro@demo.com'),
  admin: await login('admin@demo.com'),
};
const units = (await request('GET', '/units')).data;
const centro = units.find((u) => u.name.includes('Centro'));
const norte = units.find((u) => u.name.includes('Norte'));

const A = 'allow';
const D = 'deny';
const ROLES = ['anon', 'donor', 'collaborator', 'nurse', 'admin'];
/** [método, caminho, corpo, expectativa por papel: anon, donor, collaborator, nurse, admin] */
const MATRIX = [
  ['GET', '/users/me', undefined, [D, A, A, A, A]],
  ['GET', '/admin/users', undefined, [D, D, D, D, A]],
  ['GET', '/units', undefined, [A, A, A, A, A]],
  ['GET', '/units?includeInactive=true', undefined, [D, D, D, D, A]],
  ['POST', '/units', {}, [D, D, D, D, A]],
  ['PUT', `/units/${centro.id}/schedule-rules`, {}, [D, D, D, D, A]],
  ['GET', '/campaigns', undefined, [A, A, A, A, A]],
  ['POST', '/campaigns', {}, [D, D, D, D, A]],
  [
    'GET',
    `/appointments/availability?unitId=${centro.id}&from=${today}&to=${today}`,
    undefined,
    [A, A, A, A, A],
  ],
  ['POST', '/appointments', {}, [D, A, D, D, D]],
  ['GET', '/appointments/me', undefined, [D, A, D, D, D]],
  ['GET', `/agenda?unitId=${centro.id}&date=${today}`, undefined, [D, D, A, A, A]],
  ['GET', `/agenda?unitId=${norte.id}&date=${today}`, undefined, [D, D, D, D, A]],
  ['PATCH', `/appointments/${RANDOM_ID}/check-in`, undefined, [D, D, A, A, D]],
  ['PATCH', `/appointments/${RANDOM_ID}/no-show`, undefined, [D, D, A, A, D]],
  ['GET', '/admin/appointments', undefined, [D, D, D, D, A]],
  ['GET', '/screenings/questionnaire', undefined, [D, A, D, D, D]],
  ['POST', '/screenings/pre-check', {}, [D, A, D, D, D]],
  ['GET', '/attendances/fields', undefined, [D, D, D, A, D]],
  ['POST', '/attendances', {}, [D, D, D, A, D]],
  ['GET', `/attendances/appointment/${RANDOM_ID}/pre-screening`, undefined, [D, D, D, A, D]],
  ['POST', '/donations', {}, [D, D, D, A, D]],
  ['GET', '/donations/history', undefined, [D, A, D, D, D]],
  ['GET', '/donations/eligibility', undefined, [D, A, D, D, D]],
  ['GET', '/admin/donations', undefined, [D, D, D, D, A]],
  ['GET', '/documents/me', undefined, [D, A, D, D, D]],
  ['POST', '/documents', {}, [D, A, D, D, D]],
  ['GET', '/documents/verify/PUL-XXXX-XXXX', undefined, [A, A, A, A, A]],
  ['GET', '/clinical-settings', undefined, [D, D, D, D, A]],
  ['GET', '/screening-config', undefined, [D, D, D, D, A]],
  ['GET', '/blood-inventory', undefined, [D, D, D, D, A]],
  ['GET', '/blood-inventory/public', undefined, [A, A, A, A, A]],
  ['POST', '/blood-inventory/movements', {}, [D, D, D, D, A]],
  ['GET', '/blood-inventory/history?days=7', undefined, [D, D, D, D, A]],
  ['GET', '/gamification/profile', undefined, [D, A, D, D, D]],
  ['GET', '/gamification/ranking', undefined, [D, A, D, D, D]],
  ['GET', '/complementary-hours/me', undefined, [D, A, D, D, D]],
  ['GET', '/institutions', undefined, [A, A, A, A, A]],
  ['GET', '/admin/complementary-hours', undefined, [D, D, D, D, A]],
  ['GET', '/admin/gamification/settings', undefined, [D, D, D, D, A]],
  ['GET', '/admin/achievements', undefined, [D, D, D, D, A]],
  ['GET', '/admin/institutions', undefined, [D, D, D, D, A]],
  ['GET', '/notifications', undefined, [D, A, A, A, A]],
  ['GET', '/notifications/unread-count', undefined, [D, A, A, A, A]],
  ['GET', `/dashboard/statistics?from=${today}&to=${today}`, undefined, [D, D, D, D, A]],
  ['GET', '/dashboard/public-stats', undefined, [A, A, A, A, A]],
  ['GET', '/audit-logs', undefined, [D, D, D, D, A]],
];

let failures = 0;
let checks = 0;
const isDenied = (status) => status === 401 || status === 403;

console.log(`Matriz de autorização do Pulso em ${BASE_URL}\n`);
for (const [method, path, body, expected] of MATRIX) {
  const cells = [];
  for (const [index, role] of ROLES.entries()) {
    const { status } = await request(method, path, tokens[role], body);
    const ok = expected[index] === D ? isDenied(status) : !isDenied(status) && status < 500;
    checks += 1;
    if (!ok) failures += 1;
    cells.push(`${ok ? '✔' : '✘'}${role}:${status}`);
  }
  console.log(
    `${cells.some((c) => c.startsWith('✘')) ? '✘' : '✔'} ${method} ${path}\n    ${cells.join('  ')}`,
  );
}

// --- Rotas internas nunca passam pelo gateway ---------------------------------
for (const path of ['/internal/stats?from=2026-01-01&to=2026-01-02', '/internal/audit-logs']) {
  const { status } = await request('GET', path, tokens.admin);
  checks += 1;
  const ok = status === 404;
  if (!ok) failures += 1;
  console.log(`${ok ? '✔' : '✘'} GET ${path} (admin) → ${status} (esperado 404)`);
}

// --- Token adulterado ------------------------------------------------------------
{
  const [header, payload, signature] = tokens.donor.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  const forged = Buffer.from(JSON.stringify({ ...claims, role: 'ADMIN' })).toString('base64url');
  const { status } = await request('GET', '/admin/users', `${header}.${forged}.${signature}`);
  checks += 1;
  const ok = status === 401;
  if (!ok) failures += 1;
  console.log(`${ok ? '✔' : '✘'} token com papel adulterado → ${status} (esperado 401)`);
}

// --- IDOR: um doador tentando recursos de outro ----------------------------------
{
  const email = `authz.${Date.now()}@exemplo.test`;
  const registered = await request('POST', '/auth/register', undefined, {
    name: 'Doador Curioso',
    email,
    password: 'Senha1234',
    birthDate: '1990-01-01',
    acceptTerms: true,
  });
  const intruder = registered.data.accessToken;
  const owner = tokens.donor;

  const history = (await request('GET', '/donations/history', owner)).data;
  const attendanceId = history[0]?.id;
  const document = (
    await request('POST', '/documents', owner, { attendanceId, type: 'ATTENDANCE_DECLARATION' })
  ).data;
  const notifications = (await request('GET', '/notifications', owner)).data;
  const myAppointments = (await request('GET', '/appointments/me', owner)).data;
  const appointmentId = myAppointments[0]?.id ?? RANDOM_ID;
  const preCheck = await request('POST', '/screenings/pre-check', owner, {
    answers: {
      WEIGHT_50: true,
      FEELING_WELL: true,
      SLEPT_6H: true,
      ATE_RECENTLY: true,
      ALCOHOL_12H: false,
      RECENT_ILLNESS: false,
      MEDICATION: false,
      TATTOO_12M: false,
      RECENT_PROCEDURE: false,
      DONATED_BEFORE: false,
    },
    shareWithStaff: true,
  });

  const attempts = [
    ['GET', `/donations/history/${attendanceId}`],
    ['GET', `/documents/${document.id}/file`],
    ['PATCH', `/notifications/${notifications.items[0].id}/read`],
    ['GET', `/appointments/${appointmentId}`],
    ['PATCH', `/appointments/${appointmentId}/cancel`],
    ['PATCH', `/screenings/pre-check/${preCheck.data.id}/sharing`, { shared: false }],
  ];
  for (const [method, path, body] of attempts) {
    const { status } = await request(method, path, intruder, body);
    checks += 1;
    const ok = status === 404 || status === 403;
    if (!ok) failures += 1;
    console.log(`${ok ? '✔' : '✘'} IDOR ${method} ${path} → ${status} (esperado 404)`);
  }
}

console.log(`\n${checks - failures}/${checks} verificações de autorização corretas.`);
process.exit(failures === 0 ? 0 : 1);

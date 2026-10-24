#!/usr/bin/env node
/**
 * Jornada de ponta a ponta do SangueConecta (os 22 passos do critério de aceite), pela
 * API real e com o banco de dados: cadastro → pré-triagem → agendamento →
 * atendimento da enfermagem → doação → pontos, conquista e documento →
 * dashboard, estoque, gráficos e histórico do administrador.
 *
 * Pré-requisito: a pilha no ar (docker compose up) com os dados de demonstração
 * e DEMO_EARLY_CHECK_IN=true (padrão do docker-compose.yml), para a enfermagem
 * atender um agendamento de dia futuro na mesma execução.
 *
 * Uso:
 *   node scripts/e2e-journey.mjs                    # http://localhost:8080
 *   BASE_URL=http://localhost:3000 node scripts/e2e-journey.mjs
 *
 * Sai com código 1 no primeiro passo que falhar.
 */
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;
const DEMO_PASSWORD = 'Pulso@2026';
const NURSE = 'enfermeiro@demo.com';
const ADMIN = 'admin@demo.com';
const CENTRO_UNIT_NAME = 'SangueConecta Unidade Centro';

const results = [];
let step = 0;

class HttpError extends Error {
  constructor(status, body, method, path) {
    super(`${method} ${path} → ${status}: ${body?.detail ?? JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

async function http(method, path, { token, body, raw = false } = {}) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (raw) {
    if (!response.ok) throw new HttpError(response.status, await response.text(), method, path);
    return response;
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new HttpError(response.status, data, method, path);
  return data;
}

async function check(title, fn) {
  step += 1;
  const label = `${String(step).padStart(2, ' ')}. ${title}`;
  try {
    const detail = await fn();
    results.push({ label, ok: true });
    console.log(`  ✔ ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    results.push({ label, ok: false });
    console.log(`  ✘ ${label}\n      ${error.message}`);
    summary();
    process.exit(1);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Espera um efeito assíncrono (eventos entre serviços) aparecer. */
async function eventually(fn, { timeoutMs = 20_000, intervalMs = 500, what }) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`tempo esgotado esperando ${what}${last ? ` (${last.message})` : ''}`);
}

function summary() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} passos concluídos (${BASE_URL}).`);
}

const login = async (email, password = DEMO_PASSWORD) =>
  (await http('POST', '/auth/login', { body: { email, password } })).accessToken;

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);
const plusDays = (date, days) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const ctx = {};
const email = `e2e.${Date.now()}@exemplo.test`;
console.log(`Jornada E2E do SangueConecta em ${BASE_URL}\n`);

// --- Doador ----------------------------------------------------------------
await check('cadastrar um doador', async () => {
  const session = await http('POST', '/auth/register', {
    body: {
      name: 'Teste Jornada Completa',
      email,
      password: 'Senha1234',
      birthDate: '1994-03-15',
      acceptTerms: true,
      acceptCommunications: true,
    },
  });
  assert(session.user.role === 'DONOR', 'papel diferente de DONOR');
  ctx.donorId = session.user.id;
  return email;
});

await check('fazer login', async () => {
  ctx.donor = await login(email, 'Senha1234');
  const me = await http('GET', '/users/me', { token: ctx.donor });
  assert(me.donor?.donorCode, 'perfil de doador sem código');
  return `código ${me.donor.donorCode}`;
});

await check('responder a pré-triagem', async () => {
  const questionnaire = await http('GET', '/screenings/questionnaire', { token: ctx.donor });
  const answers = {};
  for (const question of questionnaire.questions) {
    if (question.showIf) continue;
    // Respostas que não disparam regras (doador sem impedimentos declarados).
    const favorable = {
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
    };
    if (question.type === 'BOOLEAN') answers[question.code] = favorable[question.code] ?? false;
  }
  const result = await http('POST', '/screenings/pre-check', {
    token: ctx.donor,
    body: { answers, shareWithStaff: true },
  });
  assert(result.result === 'FAVORABLE', `resultado ${result.result}`);
  return `resultado informativo ${result.result}, compartilhado com a equipe`;
});

await check('escolher uma unidade', async () => {
  const units = await http('GET', '/units');
  const unit = units.find((u) => u.name === CENTRO_UNIT_NAME) ?? units[0];
  assert(unit, 'nenhuma unidade ativa');
  ctx.unit = unit;
  return unit.name;
});

await check('escolher a data', async () => {
  const availability = await http(
    'GET',
    `/appointments/availability?unitId=${ctx.unit.id}&from=${today}&to=${plusDays(today, 20)}`,
  );
  const day = availability.days.find((d) => d.slots.some((s) => s.remaining > 0));
  assert(day, 'nenhum dia com vagas nos próximos 20 dias');
  ctx.day = day;
  return day.date;
});

await check('escolher o horário', async () => {
  ctx.slot = ctx.day.slots.find((s) => s.remaining > 0);
  return `${ctx.slot.startsAt} (${ctx.slot.remaining} vaga(s))`;
});

await check('confirmar o agendamento', async () => {
  const appointment = await http('POST', '/appointments', {
    token: ctx.donor,
    body: { unitId: ctx.unit.id, startsAt: ctx.slot.startsAt },
  });
  assert(appointment.status === 'BOOKED', `status ${appointment.status}`);
  ctx.appointment = appointment;
  return `código ${appointment.code}`;
});

// --- Enfermagem --------------------------------------------------------------
await check('entrar como enfermeiro', async () => {
  ctx.nurse = await login(NURSE);
  return NURSE;
});

await check('visualizar o agendamento na agenda da unidade', async () => {
  const agenda = await http('GET', `/agenda?unitId=${ctx.unit.id}&date=${ctx.day.date}`, {
    token: ctx.nurse,
  });
  const item = agenda.items.find((i) => i.appointmentId === ctx.appointment.id);
  assert(item, 'agendamento não apareceu na agenda');
  assert(item.donor.name === 'Teste Jornada Completa', 'nome do doador não veio do identity');
  const checkedIn = await http('PATCH', `/appointments/${ctx.appointment.id}/check-in`, {
    token: ctx.nurse,
  });
  assert(checkedIn.status === 'CHECKED_IN', 'check-in não registrado');
  return `check-in feito (${agenda.items.length} atendimento(s) no dia)`;
});

await check('realizar a triagem', async () => {
  const shared = await http('GET', `/attendances/appointment/${ctx.appointment.id}/pre-screening`, {
    token: ctx.nurse,
  });
  assert(shared?.answers?.length > 0, 'pré-triagem compartilhada não visível para a enfermagem');
  const fields = await http('GET', '/attendances/fields', { token: ctx.nurse });
  const sample = {
    WEIGHT: 72,
    BLOOD_PRESSURE: '120/80',
    HEART_RATE: 74,
    TEMPERATURE: 36.5,
    HEMOGLOBIN: 14.1,
  };
  const values = {};
  for (const field of fields) {
    if (sample[field.code] !== undefined) values[field.code] = sample[field.code];
    else if (field.required) values[field.code] = field.type === 'NUMBER' ? (field.min ?? 1) : 'ok';
  }
  const attendance = await http('POST', '/attendances', {
    token: ctx.nurse,
    body: { appointmentId: ctx.appointment.id, values, result: 'FIT' },
  });
  ctx.attendanceId = attendance.id;
  return `resultado: apto (${fields.length} campos configuráveis)`;
});

await check('registrar a doação', async () => {
  const attendance = await http('POST', '/donations', {
    token: ctx.nurse,
    body: {
      attendanceId: ctx.attendanceId,
      bloodType: 'A_POS',
      volumeMl: 450,
      status: 'COMPLETED',
    },
  });
  assert(attendance.donation?.status === 'COMPLETED', 'doação não registrada');
  ctx.donationCode = attendance.donation.code;
  return `código ${attendance.donation.code}`;
});

// --- Doador de novo ------------------------------------------------------------
await check('entrar novamente como doador', async () => {
  ctx.donor = await login(email, 'Senha1234');
  const appointment = await eventually(
    async () => {
      const a = await http('GET', `/appointments/${ctx.appointment.id}`, { token: ctx.donor });
      return a.status === 'COMPLETED' && a;
    },
    { what: 'o agendamento ficar concluído (evento clinical.attendance.completed)' },
  );
  return `agendamento ${appointment.code} concluído`;
});

await check('visualizar a doação no histórico', async () => {
  const history = await http('GET', '/donations/history', { token: ctx.donor });
  const item = history.find((h) => h.id === ctx.attendanceId);
  assert(item?.donation?.code === ctx.donationCode, 'doação não está no histórico');
  const eligibility = await http('GET', '/donations/eligibility', { token: ctx.donor });
  return `próxima data informativa ${eligibility.nextEligibleAt}`;
});

await check('receber pontos', async () => {
  const profile = await eventually(
    async () => {
      const p = await http('GET', '/gamification/profile', { token: ctx.donor });
      return p.totalPoints > 0 && p;
    },
    { what: 'os pontos (evento consumido pelo engagement)' },
  );
  return `${profile.totalPoints} pontos, nível ${profile.level.name}`;
});

await check('desbloquear conquista', async () => {
  const profile = await eventually(
    async () => {
      const p = await http('GET', '/gamification/profile', { token: ctx.donor });
      return p.achievements.some((a) => a.code === 'FIRST_DONATION' && a.unlocked) && p;
    },
    { what: 'a conquista Primeira Doação' },
  );
  const notifications = await eventually(
    async () => {
      const n = await http('GET', '/notifications?pageSize=50', { token: ctx.donor });
      return n.items.some((i) => i.type === 'ACHIEVEMENT_UNLOCKED') && n;
    },
    { what: 'a notificação da conquista' },
  );
  const unlocked = profile.achievements.filter((a) => a.unlocked).map((a) => a.name);
  return `${unlocked.join(', ')}; ${notifications.total} notificações`;
});

await check('gerar documento', async () => {
  const document = await http('POST', '/documents', {
    token: ctx.donor,
    body: { attendanceId: ctx.attendanceId, type: 'DONATION_DECLARATION' },
  });
  const file = await http('GET', `/documents/${document.id}/file`, { token: ctx.donor, raw: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  assert(bytes.subarray(0, 5).toString() === '%PDF-', 'o arquivo não é um PDF');
  const verification = await http(
    'GET',
    `/documents/verify/${encodeURIComponent(document.verificationCode)}`,
  );
  assert(verification.valid === true, 'verificação pública falhou');
  return `PDF de ${bytes.length} bytes, código ${document.verificationCode} verificado`;
});

// --- Administração -------------------------------------------------------------
await check('entrar como administrador', async () => {
  ctx.admin = await login(ADMIN);
  return ADMIN;
});

await check('visualizar o dashboard', async () => {
  const stats = await http(
    'GET',
    `/dashboard/statistics?from=${plusDays(today, -30)}&to=${plusDays(today, 30)}`,
    {
      token: ctx.admin,
    },
  );
  assert(stats.unavailable.length === 0, `serviços indisponíveis: ${stats.unavailable.join(', ')}`);
  assert(stats.clinical.donationsCompleted > 0, 'nenhuma doação no período');
  return `${stats.clinical.donationsCompleted} doações e ${stats.identity.donorsTotal} doadores`;
});

await check('visualizar o estoque', async () => {
  const overview = await http('GET', '/blood-inventory', { token: ctx.admin });
  assert(overview.items.length === 8, 'esperava 8 tipos sanguíneos');
  ctx.stock = Object.fromEntries(overview.items.map((i) => [i.bloodType, i.quantity]));
  return `${overview.totals.quantity} bolsas; ${overview.totals.critical} tipo(s) crítico(s)`;
});

await check('adicionar e remover estoque', async () => {
  const input = await http('POST', '/blood-inventory/movements', {
    token: ctx.admin,
    body: {
      bloodType: 'O_NEG',
      type: 'IN',
      quantity: 5,
      reason: 'PROCESSED_COLLECTION',
      notes: 'E2E',
    },
  });
  const output = await http('POST', '/blood-inventory/movements', {
    token: ctx.admin,
    body: {
      bloodType: 'O_NEG',
      type: 'OUT',
      quantity: 2,
      reason: 'HOSPITAL_DISTRIBUTION',
      notes: 'E2E',
    },
  });
  assert(output.balanceAfter === ctx.stock.O_NEG + 3, 'saldo final inesperado');
  return `O−: ${ctx.stock.O_NEG} → ${input.balanceAfter} → ${output.balanceAfter}`;
});

await check('visualizar os gráficos', async () => {
  const history = await http('GET', '/blood-inventory/history?days=30', { token: ctx.admin });
  assert(history.points.length >= 30, 'série histórica incompleta');
  const stats = await http(
    'GET',
    `/dashboard/statistics?from=${plusDays(today, -180)}&to=${today}`,
    {
      token: ctx.admin,
    },
  );
  assert(
    stats.clinical.byMonth.length > 0 && stats.clinical.byBloodType.length > 0,
    'séries vazias',
  );
  return `${history.points.length} dias de estoque; ${stats.clinical.byMonth.length} meses de doações`;
});

await check('visualizar o histórico', async () => {
  const movements = await http('GET', '/blood-inventory/movements?bloodType=O_NEG&pageSize=5', {
    token: ctx.admin,
  });
  assert(movements.items[0]?.notes === 'E2E', 'movimentação recente não aparece no histórico');
  const audit = await http('GET', '/audit-logs?limit=50', { token: ctx.admin });
  assert(
    audit.items.some((i) => i.action === 'stock.movement_created'),
    'auditoria sem a movimentação',
  );
  return `${movements.total} movimentações de O−; ${audit.items.length} registros de auditoria`;
});

summary();
